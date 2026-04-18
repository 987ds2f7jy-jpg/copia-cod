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

    async createAppointment(params): Promise<AppointmentRecord> {
      const { data, error } = await client
        .from('appointments')
        .insert({
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
          current_payment_charge_id,
          symptoms,
          accepted_at,
          consulta_id
        `)
        .single();

      if (error) {
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

      const paymentCharge = await createPaymentCharge(client, {
        ownerType: 'appointment',
        ownerId: row.id,
        amount: Number(row.gross_price),
        currency: 'BRL',
      });

      return {
        ...row,
        current_payment_charge_id: paymentCharge.paymentChargeId,
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
