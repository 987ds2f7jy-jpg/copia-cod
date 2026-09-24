import { AppError } from '../_shared/errors.ts';
import { InternalNotificationService } from '../_shared/notifications/InternalNotificationService.ts';
import { createServiceRoleClient, type SupabaseClient } from '../_shared/supabase.ts';
import type {
  AppointmentReminderRecord,
  AppointmentReminderRepository,
} from './types.ts';

export function createAppointmentReminderRepository(
  client: SupabaseClient,
): AppointmentReminderRepository {
  return {
    async listAppointmentsForDate({ date, eligibleStatuses }) {
      const { data, error } = await client
        .from('appointments')
        .select(`
          id,
          patient_id,
          professional_id,
          appointment_type,
          scheduled_datetime,
          date,
          time,
          status
        `)
        .eq('date', date)
        .in('status', eligibleStatuses)
        .order('time', { ascending: true });

      if (error) {
        throw new AppError({
          status: 500,
          code: 'APPOINTMENT_REMINDER_LOOKUP_FAILED',
          message: 'Unable to load appointments for daily reminders.',
          details: error.message,
        });
      }

      return (data || []) as AppointmentReminderRecord[];
    },

    async findProfessionalAppUserId(profileId) {
      const { data, error } = await client
        .from('professional_profiles')
        .select('id, user_id')
        .eq('id', profileId)
        .maybeSingle();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'APPOINTMENT_REMINDER_PROFESSIONAL_LOOKUP_FAILED',
          message: 'Unable to resolve appointment reminder recipient.',
          details: error.message,
        });
      }

      return String(data?.user_id || '').trim() || null;
    },
  };
}

export function createAppointmentReminderRuntime() {
  const client = createServiceRoleClient();

  return {
    notificationService: new InternalNotificationService(client),
    repository: createAppointmentReminderRepository(client),
  };
}
