import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { createPaymentCharge } from '../_shared/payments/create-payment-charge.ts';
import {
  resolvePlanCoverage,
  type PlanCoverageVerification,
} from '../_shared/plans/coverage.ts';
import { resolveServicePricing } from '../_shared/pricing/resolve-service-pricing.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  AppUserRecord,
  JoinQueueRepository,
  PlantaoConsultaRecord,
  PublicProfileRecord,
  QueueRecord,
  SolicitacaoPaymentSnapshotRecord,
} from './types.ts';

type AppUserRow = {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
};

const QUEUE_SELECT = `
  id,
  patient_id,
  patient_name,
  patient_email,
  specialty,
  symptoms,
  priority_level,
  status,
  position,
  estimated_wait_time,
  assigned_professional_id,
  solicitacao_exame_id,
  service_code,
  price_source,
  quoted_gross_price,
  quoted_platform_fee_percent,
  quoted_platform_fee_amount,
  quoted_professional_net_amount,
  pricing_rule_id,
  fee_rule_id,
  payment_status,
  payment_required,
  current_payment_charge_id,
  paid_at,
  funding_source,
  coverage_status,
  plan_credit_usage_id,
  plan_subscription_order_id,
  external_subscription_score_id,
  external_score_id,
  external_plan_id,
  external_specialization_id
`;

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
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
  };
}

function createJoinQueueRepository(client: SupabaseClient): JoinQueueRepository {
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

    async findActivePlantaoConsultaByPatientId(patientId: string): Promise<PlantaoConsultaRecord | null> {
      const { data, error } = await client
        .from('consultas')
        .select('id, status, tipo_consulta')
        .eq('paciente_id', patientId)
        .eq('tipo_consulta', 'plantao')
        .in('status', ['aguardando', 'em_atendimento'])
        .order('created_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'CONSULTA_LOOKUP_FAILED',
          message: 'Unable to check active consultations.',
          details: error.message,
        });
      }

      return (data as PlantaoConsultaRecord | null) || null;
    },

    async findCurrentActiveQueueEntry(patientId: string): Promise<QueueRecord | null> {
      const { data, error } = await client
        .from('queues')
        .select(`
          id,
          patient_id,
          patient_name,
          patient_email,
          specialty,
          symptoms,
          priority_level,
          status,
          position,
          estimated_wait_time,
          assigned_professional_id,
          solicitacao_exame_id,
          service_code,
          price_source,
          quoted_gross_price,
          quoted_platform_fee_percent,
          quoted_platform_fee_amount,
          quoted_professional_net_amount,
          pricing_rule_id,
          fee_rule_id,
          payment_status,
          payment_required,
          current_payment_charge_id,
          paid_at,
          funding_source,
          coverage_status,
          plan_credit_usage_id,
          plan_subscription_order_id,
          external_subscription_score_id,
          external_score_id,
          external_plan_id,
          external_specialization_id
        `)
        .eq('patient_id', patientId)
        .in('status', ['waiting', 'in_progress', 'em_atendimento'])
        .order('created_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'QUEUE_LOOKUP_FAILED',
          message: 'Unable to check existing queue entries.',
          details: error.message,
        });
      }

      return (data as QueueRecord | null) || null;
    },

    async findSolicitacaoPaymentSnapshot({
      solicitacaoExameId,
      patientId,
    }): Promise<SolicitacaoPaymentSnapshotRecord | null> {
      const { data, error } = await client
        .from('solicitacoes_exames')
        .select(`
          id,
          paciente_id,
          service_code,
          price_source,
          quoted_gross_price,
          quoted_platform_fee_percent,
          quoted_platform_fee_amount,
          quoted_professional_net_amount,
          pricing_rule_id,
          fee_rule_id,
          payment_status,
          current_payment_charge_id,
          paid_at
        `)
        .eq('id', solicitacaoExameId)
        .eq('paciente_id', patientId)
        .maybeSingle();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'SOLICITACAO_PAYMENT_SNAPSHOT_LOOKUP_FAILED',
          message: 'Unable to load linked exam request payment snapshot.',
          details: error.message,
        });
      }

      return (data as SolicitacaoPaymentSnapshotRecord | null) || null;
    },

    async listOnDutyPublicProfiles(): Promise<PublicProfileRecord[]> {
      const { data, error } = await client
        .from('professional_public_profiles')
        .select('id, specialty, status, is_on_duty')
        .eq('is_on_duty', true);

      if (error) {
        throw new AppError({
          status: 500,
          code: 'PUBLIC_PROFILE_LOOKUP_FAILED',
          message: 'Unable to load on-duty professionals.',
          details: error.message,
        });
      }

      return (data || []).map((row) => ({
        id: String(row.id),
        specialty: String(row.specialty || ''),
        status: String(row.status || ''),
        isOnDuty: Boolean(row.is_on_duty),
      }));
    },

    async resolveServicePricing(input) {
      return resolveServicePricing(client, input);
    },

    async resolvePlanCoverage(params) {
      return resolvePlanCoverage({
        client,
        appUserId: params.appUserId,
        fallbackExternalKey: params.fallbackExternalKey,
        specialtyCode: params.specialtyCode,
        flow: 'on_duty',
      });
    },

    async countWaitingQueueBySpecialty(specialty: string): Promise<number> {
      const { count, error } = await client
        .from('queues')
        .select('id', { count: 'exact', head: true })
        .eq('specialty', specialty)
        .eq('status', 'waiting');

      if (error) {
        throw new AppError({
          status: 500,
          code: 'QUEUE_COUNT_FAILED',
          message: 'Unable to calculate queue position.',
          details: error.message,
        });
      }

      return Number(count || 0);
    },

    async createQueueEntry(params): Promise<QueueRecord> {
      const isPlanFunded = Boolean(params.planCoverage) && !params.linkedPaidPayment;
      const paymentRequired = true;

      if (isPlanFunded && params.planCoverage) {
        const coverage = params.planCoverage;
        const { data: planQueueData, error: planQueueError } = await client
          .rpc('create_plan_funded_queue', {
            p_patient_id: params.patientId,
            p_patient_name: params.patientName,
            p_patient_email: params.patientEmail,
            p_specialty: params.specialty,
            p_symptoms: params.symptoms,
            p_priority_level: params.priorityLevel,
            p_position: params.position,
            p_estimated_wait_time: params.estimatedWaitTime,
            p_service_code: params.pricing.serviceCode,
            p_price_source: params.pricing.priceSource,
            p_gross_price: params.pricing.grossPrice,
            p_fee_percent: params.pricing.platformFeePercent,
            p_fee_amount: params.pricing.platformFeeAmount,
            p_net_amount: params.pricing.professionalNetAmount,
            p_pricing_rule_id: params.pricing.pricingRuleId,
            p_fee_rule_id: params.pricing.feeRuleId,
            p_plan_subscription_order_id: coverage.planSubscriptionOrderId,
            p_plans_service_subscription_id: normalizeString(coverage.externalSubscriptionId)
              || coverage.plansServiceSubscriptionId,
            p_external_subscription_score_id: coverage.externalSubscriptionScoreId,
            p_external_score_id: normalizeString(coverage.externalScoreId) || null,
            p_external_plan_id: coverage.externalPlanId,
            p_external_specialization_id: coverage.externalSpecializationId,
            p_specialty_code: coverage.specialtyCode,
            p_request_snapshot: coverage.requestSnapshot,
            p_response_snapshot: coverage.responseSnapshot,
            p_coverage_snapshot: buildCoverageSnapshot(coverage),
          })
          .single();

        if (planQueueError) {
          throw new AppError({
            status: planQueueError.code === '23505' ? 409 : 500,
            code: planQueueError.code === '23505'
              ? 'PLAN_CREDIT_ALREADY_RESERVED'
              : 'PLAN_QUEUE_CREATE_FAILED',
            message: 'Unable to create the plan-funded queue entry.',
            details: planQueueError.message,
          });
        }

        const planQueue = planQueueData as QueueRecord | null;

        if (!planQueue?.id) {
          throw new AppError({
            status: 500,
            code: 'INVALID_PLAN_QUEUE_RESPONSE',
            message: 'Plan-funded queue creation returned an invalid response.',
          });
        }

        return planQueue;
      }

      const { data, error } = await client
        .from('queues')
        .insert({
          patient_id: params.patientId,
          patient_name: params.patientName,
          patient_email: params.patientEmail,
          specialty: params.specialty,
          symptoms: params.symptoms,
          priority_level: params.priorityLevel,
          status: 'waiting',
          position: params.position,
          estimated_wait_time: params.estimatedWaitTime,
          solicitacao_exame_id: params.solicitacaoExameId,
          service_code: params.pricing.serviceCode,
          price_source: params.pricing.priceSource,
          quoted_gross_price: params.pricing.grossPrice,
          quoted_platform_fee_percent: params.pricing.platformFeePercent,
          quoted_platform_fee_amount: params.pricing.platformFeeAmount,
          quoted_professional_net_amount: params.pricing.professionalNetAmount,
          pricing_rule_id: params.pricing.pricingRuleId,
          fee_rule_id: params.pricing.feeRuleId,
          payment_status: params.linkedPaidPayment ? 'paid' : 'payment_pending',
          payment_required: paymentRequired,
          current_payment_charge_id: params.linkedPaidPayment?.currentPaymentChargeId || null,
          paid_at: params.linkedPaidPayment?.paidAt || null,
          funding_source: 'self_pay',
          coverage_status: null,
          plan_credit_usage_id: null,
          plan_subscription_order_id: null,
          external_subscription_score_id: null,
          external_score_id: null,
          external_plan_id: null,
          external_specialization_id: null,
          coverage_snapshot: {},
        })
        .select(`
          id,
          patient_id,
          patient_name,
          patient_email,
          specialty,
          symptoms,
          priority_level,
          status,
          position,
          estimated_wait_time,
          assigned_professional_id,
          solicitacao_exame_id,
          service_code,
          price_source,
          quoted_gross_price,
          quoted_platform_fee_percent,
          quoted_platform_fee_amount,
          quoted_professional_net_amount,
          pricing_rule_id,
          fee_rule_id,
          payment_status,
          payment_required,
          current_payment_charge_id,
          paid_at,
          funding_source,
          coverage_status,
          plan_credit_usage_id,
          plan_subscription_order_id,
          external_subscription_score_id,
          external_score_id,
          external_plan_id,
          external_specialization_id
        `)
        .single();

      if (error) {
        const isConcurrentRetry = error.code === '23505'
          && String(error.message || '').includes('idx_queues_active_patient_unique');

        if (isConcurrentRetry) {
          const { data: existingData, error: existingError } = await client
            .from('queues')
            .select(QUEUE_SELECT)
            .eq('patient_id', params.patientId)
            .in('status', ['waiting', 'assigned', 'in_progress', 'em_atendimento'])
            .order('created_date', { ascending: false })
            .limit(1)
            .maybeSingle();
          const existing = existingData as QueueRecord | null;

          if (!existingError && existing?.id) {
            if (existing.payment_required === false || existing.funding_source === 'plan') {
              return existing;
            }

            const existingPayment = await createPaymentCharge(client, {
              ownerType: 'queue',
              ownerId: existing.id,
              amount: Number(existing.quoted_gross_price),
              currency: 'BRL',
            });

            return {
              ...existing,
              current_payment_charge_id: existingPayment.paymentChargeId,
              payment: existingPayment,
            };
          }
        }

        throw new AppError({
          status: 500,
          code: 'QUEUE_CREATE_FAILED',
          message: 'Unable to create queue entry.',
          details: error.message,
        });
      }

      const row = data as QueueRecord | null;

      if (!row?.id) {
        throw new AppError({
          status: 500,
          code: 'INVALID_QUEUE_RESPONSE',
          message: 'Queue creation returned an invalid response.',
        });
      }

      if (params.linkedPaidPayment) {
        return row;
      }

      const paymentCharge = await createPaymentCharge(client, {
        ownerType: 'queue',
        ownerId: row.id,
        amount: Number(row.quoted_gross_price),
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

export function createJoinQueueRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    repository: createJoinQueueRepository(client),
  };
}
