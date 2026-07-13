import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import type {
  AcceptAppointmentRepository,
  AcceptAppointmentTransactionRecord,
  AppointmentAcceptanceWindowRecord,
  AppUserRecord,
  PlanAppointmentAcceptanceContext,
  ProfessionalProfileRecord,
} from './types.ts';

type SupabaseClient = ReturnType<typeof createClient>;

type ProfessionalProfileRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  specialty: string | null;
  status: string;
};

type LoadedProfessionalProfile = ProfessionalProfileRow & {
  source: 'professional_profiles';
};

type PlanAppointmentRow = {
  id: string;
  status: string | null;
  appointment_type?: string | null;
  funding_source: string | null;
  coverage_status: string | null;
  payment_required: boolean | null;
  plan_credit_usage_id: string | null;
  professional_id: string | null;
  professional_name: string | null;
  specialty: string | null;
  scheduled_datetime: string | null;
  date?: string | null;
  time?: string | null;
  accepted_at: string | null;
  consulta_id: string | null;
};

type PlanCreditUsageRow = {
  id: string;
  status: string | null;
  external_subscription_score_id: string | null;
  external_score_id: string | null;
  request_snapshot: Record<string, unknown> | null;
  response_snapshot: Record<string, unknown> | null;
};

type ConsultaRow = {
  id: string;
  status: string | null;
  tipo_consulta: string | null;
  datetime: string | null;
};

const REQUESTED_APPOINTMENT_STATUSES = new Set(['requested', 'pending', 'SOLICITADO']);
const ACCEPTED_APPOINTMENT_STATUSES = new Set(['accepted', 'confirmed', 'CONFIRMADO', 'in_progress', 'em_atendimento']);
const USE_SCORE_PATH = '/subscription-score/use';
const DEFAULT_PLANS_SERVICE_TIMEOUT_MS = 8_000;

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeComparable(value: unknown) {
  return normalizeString(value).toLowerCase();
}

function toJsonRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function getPlansServiceApiBaseUrl() {
  const rawUrl = normalizeString(
    Deno.env.get('PLANS_SERVICE_BASE_URL') || Deno.env.get('PLANS_SERVICE_URL'),
  );

  if (!rawUrl) {
    return '';
  }

  const baseUrl = rawUrl.replace(/\/+$/, '');
  return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
}

function getPlansServiceTimeoutMs() {
  const parsed = Number(Deno.env.get('PLANS_SERVICE_TIMEOUT_MS') || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : DEFAULT_PLANS_SERVICE_TIMEOUT_MS;
}

function buildUseScorePayload(context: PlanAppointmentAcceptanceContext) {
  const subscriptionScoreId = Number(context.usage?.externalSubscriptionScoreId || 0);

  if (!Number.isInteger(subscriptionScoreId) || subscriptionScoreId <= 0) {
    throw new AppError({
      status: 422,
      code: 'PLAN_CREDIT_SUBSCRIPTION_SCORE_ID_REQUIRED',
      message: 'Plan credit audit is missing the subscription score id required for consumption.',
      details: {
        appointmentId: context.appointment.id,
        planCreditUsageId: context.usage?.id || context.appointment.planCreditUsageId,
        externalScoreId: context.usage?.externalScoreId,
      },
    });
  }

  return { score_id: subscriptionScoreId };
}

async function postUseScoreToPlansService(payload: { score_id: number }) {
  const apiBaseUrl = getPlansServiceApiBaseUrl();

  if (!apiBaseUrl) {
    throw new AppError({
      status: 503,
      code: 'PLANS_SERVICE_NOT_CONFIGURED',
      message: 'Plan credit could not be consumed right now.',
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getPlansServiceTimeoutMs());
  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });
  const internalApiKey = normalizeString(Deno.env.get('PLANS_SERVICE_INTERNAL_API_KEY'));

  if (internalApiKey) {
    headers.set('X-Internal-Api-Key', internalApiKey);
  }

  try {
    const response = await fetch(`${apiBaseUrl}${USE_SCORE_PATH}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    let responsePayload: unknown = null;

    try {
      responsePayload = await response.json();
    } catch {
      responsePayload = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      payload: responsePayload,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function createServiceRoleClient() {
  return createClient(getRequiredEnv('SUPABASE_URL'), getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function createSupabaseAuthUserLookup(client: SupabaseClient): AuthenticatedUserLookup {
  return async (accessToken: string) => {
    const { data, error } = await client.auth.getUser(accessToken);

    if (error || !data?.user?.id) {
      return null;
    }

    return {
      authUserId: data.user.id,
      email: data.user.email ?? null,
    };
  };
}

async function loadProfessionalProfile(
  client: SupabaseClient,
  appUserId: string,
): Promise<LoadedProfessionalProfile | null> {
  const { data, error } = await client
    .from('professional_profiles')
    .select('id, user_id, full_name, specialty, status')
    .eq('user_id', appUserId)
    .eq('status', 'approved')
    .limit(1);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PROFESSIONAL_PROFILE_LOOKUP_FAILED',
      message: 'Unable to resolve professional profile.',
      details: error.message,
    });
  }

  const row = (data?.[0] || null) as ProfessionalProfileRow | null;

  if (!row) {
    return null;
  }

  return {
    ...row,
    source: 'professional_profiles',
  };
}

function mapTransactionError(error: { message?: string; details?: string } | null) {
  const code = String(error?.message || '').trim() || 'ACCEPT_APPOINTMENT_FAILED';
  const details = error?.details || undefined;

  if (code === 'APPOINTMENT_NOT_FOUND') {
    return new AppError({
      status: 404,
      code,
      message: 'Appointment not found.',
      details,
    });
  }

  if (code === 'APPOINTMENT_NOT_REQUESTED') {
    return new AppError({
      status: 409,
      code,
      message: 'Appointment is not in a requested state.',
      details,
    });
  }

  if (code === 'PROFESSIONAL_PROFILE_MISMATCH' || code === 'APPOINTMENT_NOT_ELIGIBLE_FOR_PROFESSIONAL') {
    return new AppError({
      status: 403,
      code,
      message: 'Professional is not allowed to accept this appointment.',
      details,
    });
  }

  if (code === 'PROFESSIONAL_PROFILE_NOT_FOUND' || code === 'PROFESSIONAL_PROFILE_NOT_ELIGIBLE') {
    return new AppError({
      status: 403,
      code,
      message: 'Active professional profile is required to accept appointments.',
      details,
    });
  }

  if (code === 'PROFESSIONAL_APP_USER_REQUIRED' || code === 'PROFESSIONAL_PROFILE_REQUIRED') {
    return new AppError({
      status: 500,
      code,
      message: 'Professional identity could not be resolved for the transaction.',
      details,
    });
  }

  if (code === 'APPOINTMENT_SCHEDULE_CONFLICT') {
    return new AppError({
      status: 409,
      code,
      message: 'Professional already has another appointment at this time.',
      details,
    });
  }

  if (code === 'APPOINTMENT_SCHEDULE_MISSING') {
    return new AppError({
      status: 422,
      code,
      message: 'Appointment is missing scheduled datetime.',
      details,
    });
  }

  if (code === 'APPOINTMENT_EXPIRED') {
    return new AppError({
      status: 409,
      code,
      message: 'Esta solicitação já passou do horário e não pode mais ser aceita.',
      details,
    });
  }

  if (
    code === 'APPOINTMENT_PRICING_SNAPSHOT_REQUIRED' ||
    code === 'APPOINTMENT_PRICE_SNAPSHOT_INVALID'
  ) {
    return new AppError({
      status: 422,
      code,
      message: 'Appointment pricing snapshot is incomplete or invalid.',
      details,
    });
  }

  if (code === 'APPOINTMENT_PAYMENT_REQUIRED') {
    return new AppError({
      status: 402,
      code,
      message: 'Appointment payment must be confirmed before acceptance.',
      details,
    });
  }

  if (code === 'APPOINTMENT_PAYMENT_CHARGE_REQUIRED') {
    return new AppError({
      status: 409,
      code,
      message: 'Appointment is missing the active payment charge required for acceptance.',
      details,
    });
  }

  if (code === 'APPOINTMENT_PAYMENT_CHARGE_NOT_PAID') {
    return new AppError({
      status: 402,
      code,
      message: 'The active appointment charge has not been confirmed as paid.',
      details,
    });
  }

  return new AppError({
    status: 500,
    code,
    message: 'Failed to accept appointment.',
    details,
  });
}

function mapPlanContext(appointment: PlanAppointmentRow, usage: PlanCreditUsageRow | null): PlanAppointmentAcceptanceContext {
  return {
    appointment: {
      id: appointment.id,
      status: appointment.status || '',
      fundingSource: appointment.funding_source || 'self_pay',
      coverageStatus: appointment.coverage_status || null,
      paymentRequired: Boolean(appointment.payment_required ?? true),
      planCreditUsageId: appointment.plan_credit_usage_id || null,
      professionalId: appointment.professional_id || null,
      professionalName: appointment.professional_name || '',
      specialty: appointment.specialty || '',
      scheduledDatetime: appointment.scheduled_datetime || null,
      acceptedAt: appointment.accepted_at || null,
      consultaId: appointment.consulta_id || null,
    },
    usage: usage?.id
      ? {
        id: usage.id,
        status: usage.status || '',
        externalSubscriptionScoreId: usage.external_subscription_score_id || null,
        externalScoreId: usage.external_score_id || null,
        requestSnapshot: usage.request_snapshot || {},
        responseSnapshot: usage.response_snapshot || {},
      }
      : null,
  };
}

function mapAcceptedAppointmentRow(
  appointment: PlanAppointmentRow,
  consulta: ConsultaRow,
): AcceptAppointmentTransactionRecord {
  return {
    appointment_id: appointment.id,
    appointment_status: appointment.status || 'accepted',
    appointment_accepted_at: appointment.accepted_at || '',
    appointment_scheduled_datetime: appointment.scheduled_datetime || '',
    appointment_professional_id: appointment.professional_id || '',
    appointment_professional_name: appointment.professional_name || '',
    consulta_id: consulta.id,
    consulta_status: consulta.status || '',
    consulta_tipo: consulta.tipo_consulta || '',
    consulta_datetime: consulta.datetime || '',
  };
}

function createSupabaseAcceptAppointmentRepository(client: SupabaseClient): AcceptAppointmentRepository {
  return {
    async findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null> {
      const { data, error } = await client
        .from('app_users')
        .select('id, auth_user_id, full_name, role, is_active')
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

      if (!data?.id) {
        return null;
      }

      return {
        id: data.id,
        authUserId: data.auth_user_id || authUserId,
        fullName: data.full_name || '',
        role: data.role || '',
        isActive: Boolean(data.is_active),
      };
    },

    async findActiveProfessionalProfileByUserId(appUserId: string): Promise<ProfessionalProfileRecord | null> {
      const profile = await loadProfessionalProfile(client, appUserId);

      if (!profile?.id) {
        return null;
      }

      return {
        appUserId,
        profileId: profile.id,
        fullName: profile.full_name || '',
        specialty: profile.specialty || '',
        source: profile.source,
      };
    },

    async findAppointmentAcceptanceWindow(appointmentId: string): Promise<AppointmentAcceptanceWindowRecord | null> {
      const { data, error } = await client
        .from('appointments')
        .select(`
          id,
          status,
          appointment_type,
          scheduled_datetime,
          date,
          time,
          payment_required,
          payment_status,
          current_payment_charge_id,
          professional_id,
          consulta_id
        `)
        .eq('id', appointmentId)
        .maybeSingle();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'APPOINTMENT_LOOKUP_FAILED',
          message: 'Unable to load appointment before acceptance.',
          details: error.message,
        });
      }

      const row = data as Record<string, unknown> | null;

      if (!row?.id) {
        return null;
      }

      return {
        id: normalizeString(row.id),
        status: normalizeString(row.status),
        appointmentType: normalizeString(row.appointment_type),
        scheduledDatetime: normalizeString(row.scheduled_datetime) || null,
        date: normalizeString(row.date) || null,
        time: normalizeString(row.time) || null,
        paymentRequired: Boolean(row.payment_required ?? true),
        paymentStatus: normalizeString(row.payment_status),
        currentPaymentChargeId: normalizeString(row.current_payment_charge_id) || null,
        professionalId: normalizeString(row.professional_id) || null,
        consultaId: normalizeString(row.consulta_id) || null,
      };
    },

    async findPlanAppointmentAcceptanceContext(appointmentId: string): Promise<PlanAppointmentAcceptanceContext | null> {
      const { data: appointmentData, error: appointmentError } = await client
        .from('appointments')
        .select(`
          id,
          status,
          funding_source,
          coverage_status,
          payment_required,
          plan_credit_usage_id,
          professional_id,
          professional_name,
          specialty,
          scheduled_datetime,
          accepted_at,
          consulta_id
        `)
        .eq('id', appointmentId)
        .maybeSingle();

      if (appointmentError) {
        throw new AppError({
          status: 500,
          code: 'APPOINTMENT_LOOKUP_FAILED',
          message: 'Unable to load appointment before acceptance.',
          details: appointmentError.message,
        });
      }

      const appointment = appointmentData as PlanAppointmentRow | null;

      if (!appointment?.id || appointment.funding_source !== 'plan') {
        return null;
      }

      let usage: PlanCreditUsageRow | null = null;

      if (appointment.plan_credit_usage_id) {
        const { data: usageData, error: usageError } = await client
          .from('plan_credit_usages')
          .select(`
            id,
            status,
            external_subscription_score_id,
            external_score_id,
            request_snapshot,
            response_snapshot
          `)
          .eq('id', appointment.plan_credit_usage_id)
          .maybeSingle();

        if (usageError) {
          throw new AppError({
            status: 500,
            code: 'PLAN_CREDIT_USAGE_LOOKUP_FAILED',
            message: 'Unable to load plan credit usage before acceptance.',
            details: usageError.message,
          });
        }

        usage = usageData as PlanCreditUsageRow | null;
      }

      return mapPlanContext(appointment, usage);
    },

    async findAcceptedAppointmentResult({
      appointmentId,
      professionalProfileId,
    }): Promise<AcceptAppointmentTransactionRecord | null> {
      const { data: appointmentData, error: appointmentError } = await client
        .from('appointments')
        .select('id, status, accepted_at, scheduled_datetime, professional_id, professional_name, consulta_id')
        .eq('id', appointmentId)
        .maybeSingle();

      if (appointmentError) {
        throw new AppError({
          status: 500,
          code: 'APPOINTMENT_LOOKUP_FAILED',
          message: 'Unable to load accepted appointment.',
          details: appointmentError.message,
        });
      }

      const appointment = appointmentData as PlanAppointmentRow | null;

      if (
        !appointment?.id
        || !appointment.consulta_id
        || normalizeString(appointment.professional_id) !== professionalProfileId
        || !ACCEPTED_APPOINTMENT_STATUSES.has(appointment.status || '')
      ) {
        return null;
      }

      const { data: consultaData, error: consultaError } = await client
        .from('consultas')
        .select('id, status, tipo_consulta, datetime')
        .eq('id', appointment.consulta_id)
        .maybeSingle();

      if (consultaError) {
        throw new AppError({
          status: 500,
          code: 'CONSULTA_LOOKUP_FAILED',
          message: 'Unable to load accepted consultation.',
          details: consultaError.message,
        });
      }

      const consulta = consultaData as ConsultaRow | null;

      if (!consulta?.id) {
        return null;
      }

      return mapAcceptedAppointmentRow(appointment, consulta);
    },

    async confirmPlanCreditBeforeAcceptance({ context }) {
      const { appointment, usage } = context;

      if (!usage?.id || appointment.planCreditUsageId !== usage.id) {
        throw new AppError({
          status: 409,
          code: 'PLAN_CREDIT_USAGE_REQUIRED',
          message: 'Plan-funded appointments require a pending credit usage audit.',
          details: { appointmentId: appointment.id },
        });
      }

      if (usage.status === 'used') {
        return { skipped: true, reason: 'already_used' as const };
      }

      if (usage.status !== 'pending_use' && usage.status !== 'use_failed') {
        throw new AppError({
          status: 409,
          code: 'PLAN_CREDIT_USAGE_NOT_PENDING',
          message: 'Plan credit usage is not pending and cannot be consumed.',
          details: {
            appointmentId: appointment.id,
            planCreditUsageId: usage.id,
            status: usage.status,
          },
        });
      }

      const { data: claimedUsage, error: claimError } = await client
        .from('plan_credit_usages')
        .update({ status: 'consuming', error_code: null, error_message: null })
        .eq('id', usage.id)
        .eq('owner_type', 'appointment')
        .eq('owner_id', appointment.id)
        .in('status', ['pending_use', 'use_failed'])
        .select('id, status')
        .maybeSingle();

      if (claimError) {
        throw new AppError({
          status: 500,
          code: 'PLAN_CREDIT_CLAIM_FAILED',
          message: 'Unable to claim the plan credit for confirmation.',
          details: claimError.message,
        });
      }

      if (!claimedUsage?.id) {
        const { data: currentUsage } = await client
          .from('plan_credit_usages')
          .select('id, status')
          .eq('id', usage.id)
          .maybeSingle();

        if (String(currentUsage?.status || '') === 'used') {
          return { skipped: true, reason: 'already_used' as const };
        }

        throw new AppError({
          status: 409,
          code: String(currentUsage?.status || '') === 'consuming'
            ? 'PLAN_CREDIT_CONFIRMATION_IN_PROGRESS'
            : 'PLAN_CREDIT_RECONCILIATION_REQUIRED',
          message: 'Plan credit is already being confirmed or requires reconciliation.',
          details: {
            appointmentId: appointment.id,
            planCreditUsageId: usage.id,
            status: currentUsage?.status || null,
          },
        });
      }

      let requestPayload: { score_id: number };

      try {
        requestPayload = buildUseScorePayload(context);
      } catch (error) {
        await client
          .from('plan_credit_usages')
          .update({
            status: 'use_failed',
            response_snapshot: {},
            error_code: error instanceof AppError ? error.code : 'PLAN_CREDIT_PAYLOAD_INVALID',
            error_message: error instanceof Error ? error.message : 'Plan credit payload is invalid.',
          })
          .eq('id', usage.id);

        await client
          .from('appointments')
          .update({ coverage_status: 'plan_use_failed' })
          .eq('id', appointment.id);

        throw error;
      }

      let externalResponse: Awaited<ReturnType<typeof postUseScoreToPlansService>>;

      try {
        externalResponse = await postUseScoreToPlansService(requestPayload);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unable to consume plan credit.';

        await client
          .from('plan_credit_usages')
          .update({
            status: 'reconciliation_required',
            request_snapshot: requestPayload,
            response_snapshot: {},
            error_code: error instanceof AppError ? error.code : 'PLANS_SERVICE_UNAVAILABLE',
            error_message: errorMessage,
          })
          .eq('id', usage.id);

        await client
          .from('appointments')
          .update({ coverage_status: 'plan_reconciliation_required' })
          .eq('id', appointment.id);

        throw error;
      }

      if (!externalResponse.ok) {
        const responsePayload = toJsonRecord(externalResponse.payload);
        const externalError = normalizeString(responsePayload.error) || 'Failed to use subscription score';
        const ambiguous = externalResponse.status >= 500
          || externalResponse.status === 409
          || externalResponse.status === 422;

        await client
          .from('plan_credit_usages')
          .update({
            status: ambiguous ? 'reconciliation_required' : 'use_failed',
            request_snapshot: requestPayload,
            response_snapshot: {
              external_status: externalResponse.status,
              error: externalError,
            },
            error_code: `PLANS_SERVICE_${externalResponse.status}`,
            error_message: externalError,
          })
          .eq('id', usage.id);

        await client
          .from('appointments')
          .update({
            coverage_status: ambiguous ? 'plan_reconciliation_required' : 'plan_use_failed',
          })
          .eq('id', appointment.id);

        throw new AppError({
          status: 409,
          code: ambiguous ? 'PLAN_CREDIT_RECONCILIATION_REQUIRED' : 'PLAN_CREDIT_USE_FAILED',
          message: ambiguous
            ? 'A confirmacao do credito ficou ambigua e requer reconciliacao antes de liberar o atendimento.'
            : 'Nao foi possivel confirmar o credito do plano.',
          details: {
            appointmentId: appointment.id,
            planCreditUsageId: usage.id,
            externalStatus: externalResponse.status,
            externalError,
          },
        });
      }

      const responseSnapshot = {
        external_status: externalResponse.status,
        confirmed: true,
      };
      const { error: finalizeError } = await client.rpc('finalize_plan_credit_usage', {
        p_usage_id: usage.id,
        p_owner_type: 'appointment',
        p_owner_id: appointment.id,
        p_request_snapshot: requestPayload,
        p_response_snapshot: responseSnapshot,
      });

      if (finalizeError) {
        await client
          .from('plan_credit_usages')
          .update({
            status: 'reconciliation_required',
            request_snapshot: requestPayload,
            response_snapshot: { external_confirmed: true },
            error_code: 'PLAN_CREDIT_LOCAL_FINALIZE_FAILED',
            error_message: finalizeError.message,
          })
          .eq('id', usage.id)
          .eq('status', 'consuming');

        await client
          .from('appointments')
          .update({ coverage_status: 'plan_reconciliation_required' })
          .eq('id', appointment.id);

        throw new AppError({
          status: 500,
          code: 'PLAN_CREDIT_LOCAL_FINALIZE_FAILED',
          message: 'Plan credit was confirmed externally but requires local reconciliation.',
          details: { appointmentId: appointment.id, planCreditUsageId: usage.id },
        });
      }

      return { skipped: false, reason: 'used_now' as const };
    },

    async acceptAppointment({
      appointmentId,
      professionalAppUserId,
      professionalProfileId,
    }): Promise<AcceptAppointmentTransactionRecord> {
      const { data, error } = await client
        .rpc('accept_appointment_transaction', {
          p_appointment_id: appointmentId,
          p_professional_app_user_id: professionalAppUserId,
          p_professional_profile_id: professionalProfileId,
        })
        .single();

      if (error) {
        throw mapTransactionError(error);
      }

      const row = data as AcceptAppointmentTransactionRecord | null;

      if (!row?.appointment_id || !row?.consulta_id) {
        throw new AppError({
          status: 500,
          code: 'INVALID_RPC_RESPONSE',
          message: 'Database transaction returned an invalid response.',
        });
      }

      return row;
    },
  };
}

export function createAcceptAppointmentRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client),
    repository: createSupabaseAcceptAppointmentRepository(client),
  };
}
