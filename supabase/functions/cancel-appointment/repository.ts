import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { findAppUserByAuthUserId } from '../_shared/appUsers.ts';
import { AppError } from '../_shared/errors.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  AppointmentRecord,
  CancelAppointmentRepository,
} from './types.ts';

function createCancelAppointmentRepository(client: SupabaseClient): CancelAppointmentRepository {
  return {
    async findAppUserByAuthUserId(authUserId: string) {
      return findAppUserByAuthUserId(client, authUserId);
    },

    async findAppointmentById(appointmentId: string): Promise<AppointmentRecord | null> {
      const { data, error } = await client
        .from('appointments')
        .select(`
          id,
          patient_id,
          professional_id,
          status,
          cancellation_reason,
          professional_name,
          specialty,
          scheduled_datetime,
          date,
          time
        `)
        .eq('id', appointmentId)
        .maybeSingle();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'APPOINTMENT_LOOKUP_FAILED',
          message: 'Unable to load appointment.',
          details: error.message,
        });
      }

      return (data as AppointmentRecord | null) || null;
    },

    async listProfessionalIdentityIdsForUser(userId: string): Promise<string[]> {
      const [privateResult, legacyResult] = await Promise.all([
        client.from('professional_profiles').select('id').eq('user_id', userId),
        client.from('professionals').select('id').eq('user_id', userId),
      ]);

      if (privateResult.error) {
        throw new AppError({
          status: 500,
          code: 'PROFESSIONAL_PROFILE_LOOKUP_FAILED',
          message: 'Unable to load professional identities.',
          details: privateResult.error.message,
        });
      }

      if (legacyResult.error) {
        throw new AppError({
          status: 500,
          code: 'PROFESSIONAL_LEGACY_LOOKUP_FAILED',
          message: 'Unable to load professional identities.',
          details: legacyResult.error.message,
        });
      }

      return [
        ...(privateResult.data || []).map((row) => String(row.id || '')),
        ...(legacyResult.data || []).map((row) => String(row.id || '')),
      ].filter(Boolean);
    },

    async cancelAppointment({ appointmentId, reason }): Promise<AppointmentRecord> {
      const payload: {
        status: string;
        cancellation_reason?: string | null;
      } = {
        status: 'CANCELADO',
      };

      if (reason) {
        payload.cancellation_reason = reason;
      }

      const { data, error } = await client
        .from('appointments')
        .update(payload)
        .eq('id', appointmentId)
        .select(`
          id,
          patient_id,
          professional_id,
          status,
          cancellation_reason,
          professional_name,
          specialty,
          scheduled_datetime,
          date,
          time
        `)
        .single();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'APPOINTMENT_CANCEL_FAILED',
          message: 'Unable to cancel appointment.',
          details: error.message,
        });
      }

      const appointment = data as AppointmentRecord | null;

      if (!appointment?.id) {
        throw new AppError({
          status: 500,
          code: 'INVALID_APPOINTMENT_RESPONSE',
          message: 'Appointment cancellation returned an invalid response.',
        });
      }

      return appointment;
    },
  };
}

export function createCancelAppointmentRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    repository: createCancelAppointmentRepository(client),
  };
}
