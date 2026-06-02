import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { createPaymentCharge } from '../_shared/payments/create-payment-charge.ts';
import { resolveServicePricing } from '../_shared/pricing/resolve-service-pricing.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  AppUserRecord,
  AppointmentRecord,
  AvailabilitySlotRecord,
  CreateAppointmentRepository,
  PlanCoverageVerification,
  ProfessionalTargetRecord,
} from './types.ts';

type AppUserRow = {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
};

type ProfessionalRow = {
  id: string;
  user_id: string | null;
  full_name: string | null;
  specialty: string | null;
  status: string | null;
  price_standard: number | null;
  price_priority: number | null;
  available_hours: string[] | null;
};

type AppointmentRow = AppointmentRecord;

type ActivePlanOrderRow = {
  id: string;
  external_plan_id: number | string | null;
  external_key: string | null;
  plans_service_subscription_id: string | null;
  status: string | null;
};

type SpecialtyPlanLookup = {
  externalSpecializationId: number;
  planIds: number[];
};

type PlanLookupCandidate = {
  planId: number;
  externalKey: string;
  order: ActivePlanOrderRow;
};

type ExternalScoreResource = {
  id?: string | number | null;
  subscription_id?: string | number | null;
  score_id?: string | number | null;
  status?: string | number | null;
  subscription?: {
    id?: string | number | null;
    plan_id?: string | number | null;
  } | null;
  score?: {
    id?: string | number | null;
  } | null;
};

const FIND_SCORE_PATH = '/subscription-score/find';
const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;

const SPECIALTY_PLAN_LOOKUPS: Record<string, SpecialtyPlanLookup> = {
  medicina_integrativa: { externalSpecializationId: 1, planIds: [3] },
  clinico_geral: { externalSpecializationId: 2, planIds: [3, 2] },
  clinica_medica: { externalSpecializationId: 2, planIds: [3, 2] },
  pediatria: { externalSpecializationId: 4, planIds: [3] },
  ginecologia: { externalSpecializationId: 5, planIds: [3] },
  dermatologia: { externalSpecializationId: 6, planIds: [3] },
  endocrinologia: { externalSpecializationId: 7, planIds: [2, 3] },
  cardiologia: { externalSpecializationId: 8, planIds: [3] },
  psiquiatria: { externalSpecializationId: 9, planIds: [1] },
  neurologia: { externalSpecializationId: 12, planIds: [3] },
  ortopedia: { externalSpecializationId: 18, planIds: [3] },
  fonoaudiologia: { externalSpecializationId: 21, planIds: [3] },
  psicologia: { externalSpecializationId: 22, planIds: [1] },
  nutricao: { externalSpecializationId: 23, planIds: [2] },
  educacao_fisica: { externalSpecializationId: 24, planIds: [2] },
};

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function normalizePlanId(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getRequestTimeoutMs() {
  const parsed = Number(Deno.env.get('PLANS_SERVICE_TIMEOUT_MS') || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : DEFAULT_REQUEST_TIMEOUT_MS;
}

function getPlansServiceApiBaseUrl() {
  const rawUrl = normalizeString(
    Deno.env.get('PLANS_SERVICE_URL') || Deno.env.get('PLANS_SERVICE_BASE_URL'),
  );

  if (!rawUrl) {
    return '';
  }

  const baseUrl = rawUrl.replace(/\/+$/, '');
  return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
}

function toJsonRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function unwrapExternalResource(payload: unknown): ExternalScoreResource | null {
  const record = toJsonRecord(payload);
  const resource = record.data && typeof record.data === 'object'
    ? record.data
    : record;

  return resource as ExternalScoreResource;
}

async function listActivePlanOrders(client: SupabaseClient, appUserId: string) {
  const { data, error } = await client
    .from('plan_subscription_orders')
    .select(`
      id,
      external_plan_id,
      external_key,
      plans_service_subscription_id,
      status
    `)
    .or(`app_user_id.eq.${appUserId},patient_id.eq.${appUserId}`)
    .eq('status', 'active')
    .order('activated_at', { ascending: false, nullsFirst: false })
    .limit(10);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PLAN_ORDERS_LOOKUP_FAILED',
      message: 'Unable to load patient active plan orders.',
      details: error.message,
    });
  }

  return (data as ActivePlanOrderRow[] | null) || [];
}

function buildPlanLookupCandidates({
  planIds,
  activePlanOrders,
  fallbackExternalKey,
}: {
  planIds: number[];
  activePlanOrders: ActivePlanOrderRow[];
  fallbackExternalKey: string;
}) {
  const candidates: PlanLookupCandidate[] = [];

  for (const planId of planIds) {
    const order = activePlanOrders.find((activeOrder) => normalizePlanId(activeOrder.external_plan_id) === planId);
    const externalKey = normalizeString(order?.external_key) || fallbackExternalKey;

    if (order?.id && externalKey) {
      candidates.push({
        planId,
        externalKey,
        order,
      });
    }
  }

  return candidates;
}

async function postFindScoreToPlansService({
  apiBaseUrl,
  planId,
  externalKey,
  externalSpecializationId,
}: {
  apiBaseUrl: string;
  planId: number;
  externalKey: string;
  externalSpecializationId: number;
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getRequestTimeoutMs());

  try {
    const response = await fetch(`${apiBaseUrl}${FIND_SCORE_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        plan_id: planId,
        external_key: externalKey,
        specialization_id: externalSpecializationId,
      }),
      signal: controller.signal,
    });

    let payload: unknown = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      payload,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function verifyPlanCoverageForSpecialtyInternal({
  client,
  appUserId,
  fallbackExternalKey,
  specialtyCode,
}: {
  client: SupabaseClient;
  appUserId: string;
  fallbackExternalKey: string;
  specialtyCode: string;
}): Promise<PlanCoverageVerification> {
  const lookup = SPECIALTY_PLAN_LOOKUPS[specialtyCode] || null;

  if (!lookup) {
    throw new AppError({
      status: 422,
      code: 'PLAN_SPECIALTY_NOT_MAPPED',
      message: 'This specialty is not mapped to plan coverage.',
      details: { specialtyCode },
    });
  }

  const apiBaseUrl = getPlansServiceApiBaseUrl();

  if (!apiBaseUrl) {
    throw new AppError({
      status: 503,
      code: 'PLANS_SERVICE_NOT_CONFIGURED',
      message: 'Plan coverage cannot be validated right now.',
    });
  }

  const activePlanOrders = await listActivePlanOrders(client, appUserId);

  if (!activePlanOrders.length) {
    throw new AppError({
      status: 409,
      code: 'ACTIVE_PLAN_ORDER_NOT_FOUND',
      message: 'No active plan was found for this patient.',
    });
  }

  const candidates = buildPlanLookupCandidates({
    planIds: lookup.planIds,
    activePlanOrders,
    fallbackExternalKey,
  });

  if (!candidates.length) {
    throw new AppError({
      status: 409,
      code: 'PLAN_COVERAGE_NOT_AVAILABLE',
      message: 'The active plan does not cover this specialty.',
      details: {
        specialtyCode,
        lookupPlanIds: lookup.planIds,
        activePlanIds: activePlanOrders
          .map((order) => normalizePlanId(order.external_plan_id))
          .filter(Boolean),
      },
    });
  }

  for (const candidate of candidates) {
    const requestSnapshot = {
      flow: 'appointment_specialty',
      specialty_code: specialtyCode,
      plan_id: candidate.planId,
      external_specialization_id: lookup.externalSpecializationId,
      plan_subscription_order_id: candidate.order.id,
    };

    let externalResponse: Awaited<ReturnType<typeof postFindScoreToPlansService>>;

    try {
      externalResponse = await postFindScoreToPlansService({
        apiBaseUrl,
        planId: candidate.planId,
        externalKey: candidate.externalKey,
        externalSpecializationId: lookup.externalSpecializationId,
      });
    } catch (error) {
      throw new AppError({
        status: 503,
        code: 'PLANS_SERVICE_UNAVAILABLE',
        message: 'Plan coverage could not be validated right now.',
        details: error instanceof Error ? error.name : undefined,
      });
    }

    if (!externalResponse.ok) {
      if (externalResponse.status === 404) {
        continue;
      }

      throw new AppError({
        status: externalResponse.status === 400 || externalResponse.status === 422 ? 502 : 503,
        code: 'PLANS_SERVICE_COVERAGE_REJECTED',
        message: 'Plan coverage could not be validated right now.',
        details: {
          status: externalResponse.status,
          specialtyCode,
          externalPlanId: candidate.planId,
        },
      });
    }

    const resource = unwrapExternalResource(externalResponse.payload);

    if (!resource?.id) {
      continue;
    }

    const subscription = resource.subscription || null;
    const score = resource.score || null;

    return {
      covered: true,
      reason: 'plan_credit_available',
      specialtyCode,
      planSubscriptionOrderId: candidate.order.id,
      plansServiceSubscriptionId: normalizeString(candidate.order.plans_service_subscription_id) || null,
      externalSubscriptionId: subscription?.id || resource.subscription_id || null,
      externalSubscriptionScoreId: normalizeString(resource.id),
      externalScoreId: score?.id || resource.score_id || null,
      externalPlanId: normalizePlanId(subscription?.plan_id) || candidate.planId,
      externalSpecializationId: lookup.externalSpecializationId,
      rawStatus: resource.status || null,
      requestSnapshot,
      responseSnapshot: toJsonRecord(externalResponse.payload),
    };
  }

  throw new AppError({
    status: 409,
    code: 'PLAN_CREDIT_NOT_AVAILABLE',
    message: 'No plan credit is available for this specialty right now.',
    details: { specialtyCode },
  });
}

async function createPendingPlanCreditUsage({
  client,
  appointmentId,
  patientId,
  coverage,
}: {
  client: SupabaseClient;
  appointmentId: string;
  patientId: string;
  coverage: PlanCoverageVerification;
}) {
  const { data, error } = await client
    .from('plan_credit_usages')
    .insert({
      patient_id: patientId,
      owner_type: 'appointment',
      owner_id: appointmentId,
      plan_subscription_order_id: coverage.planSubscriptionOrderId,
      plans_service_subscription_id: normalizeString(coverage.externalSubscriptionId)
        || coverage.plansServiceSubscriptionId,
      external_subscription_score_id: coverage.externalSubscriptionScoreId,
      external_score_id: normalizeString(coverage.externalScoreId) || null,
      external_plan_id: coverage.externalPlanId,
      external_specialization_id: coverage.externalSpecializationId,
      specialty_code: coverage.specialtyCode,
      status: 'pending_use',
      request_snapshot: coverage.requestSnapshot,
      response_snapshot: coverage.responseSnapshot,
    })
    .select('id, status')
    .single();

  if (error) {
    throw new AppError({
      status: error.code === '23505' ? 409 : 500,
      code: error.code === '23505' ? 'PLAN_CREDIT_ALREADY_PENDING' : 'PLAN_CREDIT_USAGE_CREATE_FAILED',
      message: error.code === '23505'
        ? 'This plan credit is already pending use.'
        : 'Unable to create plan credit usage audit.',
      details: error.message,
    });
  }

  return data as { id: string; status: string };
}

function buildCoverageSnapshot(coverage: PlanCoverageVerification | null) {
  if (!coverage) {
    return {};
  }

  return {
    reason: coverage.reason,
    specialty_code: coverage.specialtyCode,
    plan_subscription_order_id: coverage.planSubscriptionOrderId,
    plans_service_subscription_id: coverage.plansServiceSubscriptionId,
    external_subscription_id: coverage.externalSubscriptionId,
    external_subscription_score_id: coverage.externalSubscriptionScoreId,
    external_score_id: coverage.externalScoreId,
    external_plan_id: coverage.externalPlanId,
    external_specialization_id: coverage.externalSpecializationId,
    raw_status: coverage.rawStatus,
    request: coverage.requestSnapshot,
    response: coverage.responseSnapshot,
  };
}

async function loadProfessionalTarget(
  client: SupabaseClient,
  profileId: string,
): Promise<ProfessionalTargetRecord | null> {
  const { data, error } = await client
    .from('professional_profiles')
    .select('id, user_id, full_name, specialty, status, price_standard, price_priority, available_hours')
    .eq('id', profileId)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PROFESSIONAL_LOOKUP_FAILED',
      message: 'Unable to resolve professional target.',
      details: error.message,
    });
  }

  const row = data as ProfessionalRow | null;

  if (!row?.id) {
    return null;
  }

  return {
    profileId: row.id,
    appUserId: row.user_id || null,
    fullName: row.full_name || '',
    specialty: row.specialty || '',
    status: row.status || '',
    priceStandard: Number(row.price_standard || 0),
    pricePriority: Number(row.price_priority || 0),
    availableHours: Array.isArray(row.available_hours) ? row.available_hours.filter(Boolean) : [],
    source: 'professional_profiles',
  };
}

function createCreateAppointmentRepository(client: SupabaseClient): CreateAppointmentRepository {
  return {
    async findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null> {
      const { data, error } = await client
        .from('app_users')
        .select('id, auth_user_id, full_name, email, role, is_active')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'APP_USER_LOOKUP_FAILED',
          message: 'Unable to load application user.',
          details: error.message,
        });
      }

      const row = data as AppUserRow | null;

      if (!row?.id) {
        return null;
      }

      return {
        id: row.id,
        authUserId: row.auth_user_id || authUserId,
        fullName: row.full_name || '',
        email: row.email || '',
        role: row.role || '',
        isActive: Boolean(row.is_active),
      };
    },

    async findProfessionalTargetById(profileId: string): Promise<ProfessionalTargetRecord | null> {
      return loadProfessionalTarget(client, profileId);
    },

    async resolveServicePricing(input) {
      return resolveServicePricing(client, input);
    },

    async listAvailabilitySlots(profileId: string): Promise<AvailabilitySlotRecord[]> {
      const { data, error } = await client
        .from('availability_slots')
        .select('weekday, time_slot')
        .eq('professional_id', profileId);

      if (error) {
        throw new AppError({
          status: 500,
          code: 'AVAILABILITY_LOOKUP_FAILED',
          message: 'Unable to load professional availability.',
          details: error.message,
        });
      }

      return (data || []).map((row) => ({
        weekday: Number(row.weekday),
        timeSlot: String(row.time_slot || ''),
      }));
    },

    async hasActiveAppointmentConflict({
      professionalId,
      scheduledDatetime,
    }): Promise<boolean> {
      const { count, error } = await client
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('professional_id', professionalId)
        .eq('scheduled_datetime', scheduledDatetime)
        .in('status', ['CONFIRMADO', 'accepted', 'confirmed', 'in_progress', 'em_atendimento']);

      if (error) {
        throw new AppError({
          status: 500,
          code: 'APPOINTMENT_CONFLICT_LOOKUP_FAILED',
          message: 'Unable to validate appointment conflicts.',
          details: error.message,
        });
      }

      return Number(count || 0) > 0;
    },

    async verifyPlanCoverageForSpecialty(params): Promise<PlanCoverageVerification> {
      return verifyPlanCoverageForSpecialtyInternal({
        client,
        appUserId: params.appUserId,
        fallbackExternalKey: params.fallbackExternalKey,
        specialtyCode: params.specialtyCode,
      });
    },

    async createAppointment(params): Promise<AppointmentRecord> {
      const isPlanFunded = params.fundingSource === 'plan';
      const paymentRequired = !isPlanFunded;
      const appointmentId = isPlanFunded ? crypto.randomUUID() : null;
      const planCoverage = params.planCoverage;
      let planCreditUsage: { id: string; status: string } | null = null;

      if (isPlanFunded) {
        if (!appointmentId || !planCoverage) {
          throw new AppError({
            status: 500,
            code: 'PLAN_COVERAGE_REQUIRED',
            message: 'Plan-funded appointments require a validated coverage snapshot.',
          });
        }

        planCreditUsage = await createPendingPlanCreditUsage({
          client,
          appointmentId,
          patientId: params.patientId,
          coverage: planCoverage,
        });
      }

      const { data, error } = await client
        .from('appointments')
        .insert({
          ...(appointmentId ? { id: appointmentId } : {}),
          patient_id: params.patientId,
          patient_name: params.patientName,
          patient_email: params.patientEmail,
          professional_id: params.professionalId,
          professional_name: params.professionalName,
          specialty: params.specialty,
          appointment_type: params.appointmentType,
          scheduled_datetime: params.scheduledDatetime,
          date: params.date,
          time: params.time,
          status: params.status,
          price: params.price,
          service_code: params.pricing.serviceCode,
          price_source: params.pricing.priceSource,
          gross_price: params.pricing.grossPrice,
          platform_fee_percent: params.pricing.platformFeePercent,
          platform_fee_amount: params.pricing.platformFeeAmount,
          professional_net_amount: params.pricing.professionalNetAmount,
          pricing_rule_id: params.pricing.pricingRuleId,
          fee_rule_id: params.pricing.feeRuleId,
          pricing_estimated: false,
          payment_status: 'payment_pending',
          payment_required: paymentRequired,
          funding_source: params.fundingSource,
          coverage_status: isPlanFunded ? 'plan_pending_use' : null,
          plan_credit_usage_id: planCreditUsage?.id || null,
          plan_subscription_order_id: planCoverage?.planSubscriptionOrderId || null,
          external_subscription_score_id: planCoverage?.externalSubscriptionScoreId || null,
          external_score_id: normalizeString(planCoverage?.externalScoreId) || null,
          external_plan_id: planCoverage?.externalPlanId || null,
          external_specialization_id: planCoverage?.externalSpecializationId || null,
          coverage_snapshot: buildCoverageSnapshot(planCoverage),
          symptoms: params.symptoms,
        })
        .select(`
          id,
          patient_id,
          patient_name,
          patient_email,
          professional_id,
          professional_name,
          specialty,
          appointment_type,
          scheduled_datetime,
          date,
          time,
          status,
          price,
          service_code,
          price_source,
          gross_price,
          platform_fee_percent,
          platform_fee_amount,
          professional_net_amount,
          pricing_rule_id,
          fee_rule_id,
          payment_status,
          payment_required,
          current_payment_charge_id,
          funding_source,
          coverage_status,
          plan_credit_usage_id,
          plan_subscription_order_id,
          external_subscription_score_id,
          external_score_id,
          external_plan_id,
          external_specialization_id,
          coverage_snapshot,
          symptoms,
          accepted_at,
          consulta_id
        `)
        .single();

      if (error) {
        if (planCreditUsage?.id) {
          try {
            await client
              .from('plan_credit_usages')
              .delete()
              .eq('id', planCreditUsage.id);
          } catch {
            // Best-effort cleanup. The creation still fails below.
          }
        }

        throw new AppError({
          status: 500,
          code: 'APPOINTMENT_CREATE_FAILED',
          message: 'Unable to create appointment.',
          details: error.message,
        });
      }

      const row = data as AppointmentRow | null;

      if (!row?.id) {
        throw new AppError({
          status: 500,
          code: 'INVALID_APPOINTMENT_RESPONSE',
          message: 'Appointment creation returned an invalid response.',
        });
      }

      if (planCreditUsage?.id && row.id) {
        const { error: usageUpdateError } = await client
          .from('plan_credit_usages')
          .update({ appointment_id: row.id })
          .eq('id', planCreditUsage.id);

        if (usageUpdateError) {
          console.warn('[create-appointment] plan-credit-usage:appointment-link-failed', {
            appointmentId: row.id,
            planCreditUsageId: planCreditUsage.id,
            error: usageUpdateError.message,
          });
        }
      }

      if (!paymentRequired) {
        return {
          ...row,
          payment: undefined,
        };
      }

      const paymentCharge = await createPaymentCharge(client, {
        ownerType: 'appointment',
        ownerId: row.id,
        amount: Number(row.gross_price),
        currency: 'BRL',
      });

      return {
        ...row,
        current_payment_charge_id: paymentCharge.paymentChargeId,
        payment: paymentCharge,
      };
    },
  };
}

export function createCreateAppointmentRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    repository: createCreateAppointmentRepository(client),
  };
}
