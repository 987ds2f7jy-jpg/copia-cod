import type { InternalNotificationNotifier } from '../_shared/notifications/notify-best-effort.ts';

export type AppointmentReminderRecord = {
  id: string;
  patient_id: string;
  professional_id: string | null;
  appointment_type: string | null;
  scheduled_datetime: string | null;
  date: string | null;
  time: string | null;
  status: string | null;
};

export type ScheduledNotificationsInput = {
  date: string | null;
};

export type AppointmentReminderRepository = {
  listAppointmentsForDate(params: {
    date: string;
    eligibleStatuses: string[];
  }): Promise<AppointmentReminderRecord[]>;
  findProfessionalAppUserId(profileId: string): Promise<string | null>;
};

export type AppointmentReminderSummary = {
  date: string;
  timeZone: string;
  appointmentsScanned: number;
  appointmentsEligible: number;
  recipientsProcessed: number;
  created: number;
  deduplicated: number;
  skipped: number;
  failed: number;
};

export type AppointmentReminderDependencies = {
  repository: AppointmentReminderRepository;
  notificationService: InternalNotificationNotifier;
};
