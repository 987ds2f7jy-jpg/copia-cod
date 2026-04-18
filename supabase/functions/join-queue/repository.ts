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
  JoinQueueRepository,
  PlantaoConsultaRecord,
  PublicProfileRecord,
  QueueRecord,
} from './types.ts';

type AppUserRow = {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
};

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
          current_payment_charge_id
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
          payment_status: 'payment_pending',
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
          current_payment_charge_id
        `)
        .single();

      if (error) {
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

      const paymentCharge = await createPaymentCharge(client, {
        ownerType: 'queue',
        ownerId: row.id,
        amount: Number(row.quoted_gross_price),
        currency: 'BRL',
      });

      return {
        ...row,
        current_payment_charge_id: paymentCharge.paymentChargeId,
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
