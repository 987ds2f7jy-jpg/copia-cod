import {
  logInternalNotificationFailure,
} from '../_shared/notifications/notify-best-effort.ts';
import type {
  AppointmentReminderDependencies,
  AppointmentReminderRecord,
  AppointmentReminderSummary,
} from './types.ts';

export const APPOINTMENT_REMINDER_TIME_ZONE = 'America/Sao_Paulo';
export const APPOINTMENT_REMINDER_ELIGIBLE_STATUSES = [
  'SOLICITADO',
  'requested',
  'pending',
  'accepted',
  'confirmed',
  'CONFIRMADO',
];

const ELIGIBLE_STATUS_SET = new Set(APPOINTMENT_REMINDER_ELIGIBLE_STATUSES);
const IMMEDIATE_APPOINTMENT_TYPES = new Set(['instant', 'plantao', 'imediato']);

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function formatZonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APPOINTMENT_REMINDER_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const byType = new Map(parts.map((part) => [part.type, part.value]));

  return {
    date: `${byType.get('year')}-${byType.get('month')}-${byType.get('day')}`,
    time: `${byType.get('hour')}:${byType.get('minute')}`,
  };
}

export function getSaoPauloDate(now = new Date()) {
  return formatZonedParts(now).date;
}

function parseScheduledDateTime(value: unknown) {
  const raw = normalizeString(value);

  if (!raw) {
    return null;
  }

  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : formatZonedParts(parsed);
  }

  const normalized = raw.replace(' ', 'T');
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  return match ? { date: match[1], time: `${match[2]}:${match[3]}` } : null;
}

export function resolveAppointmentLocalDate(appointment: AppointmentReminderRecord) {
  const explicitDate = normalizeString(appointment.date);
  return /^\d{4}-\d{2}-\d{2}$/.test(explicitDate)
    ? explicitDate
    : parseScheduledDateTime(appointment.scheduled_datetime)?.date || '';
}

export function resolveAppointmentLocalTime(appointment: AppointmentReminderRecord) {
  const explicitTime = normalizeString(appointment.time);
  const match = explicitTime.match(/^(\d{2}):(\d{2})/);

  if (match) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${match[1]}:${match[2]}`;
    }
  }

  return parseScheduledDateTime(appointment.scheduled_datetime)?.time || '';
}

function isEligibleAppointment(appointment: AppointmentReminderRecord, date: string) {
  const status = normalizeString(appointment.status);
  const appointmentType = normalizeString(appointment.appointment_type).toLowerCase();

  return ELIGIBLE_STATUS_SET.has(status) &&
    !IMMEDIATE_APPOINTMENT_TYPES.has(appointmentType) &&
    resolveAppointmentLocalDate(appointment) === date;
}

async function notifyRecipient({
  appointment,
  appointmentTime,
  recipientUserId,
  recipientRole,
  executionId,
  notificationService,
}: {
  appointment: AppointmentReminderRecord;
  appointmentTime: string;
  recipientUserId: string;
  recipientRole: 'patient' | 'professional';
  executionId: string;
  notificationService: AppointmentReminderDependencies['notificationService'];
}) {
  const deduplicationKey = `appointment:${appointment.id}:reminder_day:${recipientRole}:${recipientUserId}`;
  const context = {
    functionName: 'notifications-dispatch-scheduled',
    requestId: executionId,
    typeKey: 'appointment.reminder_day',
    recipientUserId,
    relatedEntityType: 'appointment',
    relatedEntityId: appointment.id,
    deduplicationKey,
  };

  try {
    const result = await notificationService.notify({
      recipientUserId,
      typeKey: 'appointment.reminder_day',
      data: { appointment_time: appointmentTime },
      relatedEntityType: 'appointment',
      relatedEntityId: appointment.id,
      deduplicationKey,
    });
    const outcome = result.skipped
      ? 'skipped'
      : result.deduplicated
      ? 'deduplicated'
      : 'created';

    console.info('[notifications-dispatch-scheduled] reminder:result', {
      executionId,
      appointmentId: appointment.id,
      recipientUserId,
      recipientRole,
      typeKey: 'appointment.reminder_day',
      deduplicationKey,
      outcome,
    });
    return outcome;
  } catch (error) {
    logInternalNotificationFailure(context, error);
    console.error('[notifications-dispatch-scheduled] reminder:result', {
      executionId,
      appointmentId: appointment.id,
      recipientUserId,
      recipientRole,
      typeKey: 'appointment.reminder_day',
      deduplicationKey,
      outcome: 'error',
    });
    return 'failed' as const;
  }
}

export async function dispatchDailyAppointmentReminders({
  date,
  executionId,
  repository,
  notificationService,
}: {
  date: string;
  executionId: string;
} & AppointmentReminderDependencies): Promise<AppointmentReminderSummary> {
  const appointments = await repository.listAppointmentsForDate({
    date,
    eligibleStatuses: APPOINTMENT_REMINDER_ELIGIBLE_STATUSES,
  });
  const summary: AppointmentReminderSummary = {
    date,
    timeZone: APPOINTMENT_REMINDER_TIME_ZONE,
    appointmentsScanned: appointments.length,
    appointmentsEligible: 0,
    recipientsProcessed: 0,
    created: 0,
    deduplicated: 0,
    skipped: 0,
    failed: 0,
  };

  function recordOutcome(outcome: 'created' | 'deduplicated' | 'skipped' | 'failed') {
    summary.recipientsProcessed += 1;
    summary[outcome] += 1;
  }

  for (const appointment of appointments) {
    if (!isEligibleAppointment(appointment, date)) {
      continue;
    }

    summary.appointmentsEligible += 1;
    const appointmentTime = resolveAppointmentLocalTime(appointment);

    if (!appointmentTime) {
      logInternalNotificationFailure({
        functionName: 'notifications-dispatch-scheduled',
        requestId: executionId,
        typeKey: 'appointment.reminder_day',
        recipientUserId: appointment.patient_id,
        relatedEntityType: 'appointment',
        relatedEntityId: appointment.id,
        deduplicationKey: null,
      }, new Error('Eligible appointment does not have a valid local time.'));
      summary.failed += 1;
      continue;
    }

    recordOutcome(await notifyRecipient({
      appointment,
      appointmentTime,
      recipientUserId: appointment.patient_id,
      recipientRole: 'patient',
      executionId,
      notificationService,
    }));

    if (!appointment.professional_id) {
      continue;
    }

    try {
      const professionalUserId = await repository.findProfessionalAppUserId(
        appointment.professional_id,
      );

      if (!professionalUserId) {
        throw new Error('Assigned professional does not have an app user id.');
      }

      recordOutcome(await notifyRecipient({
        appointment,
        appointmentTime,
        recipientUserId: professionalUserId,
        recipientRole: 'professional',
        executionId,
        notificationService,
      }));
    } catch (error) {
      logInternalNotificationFailure({
        functionName: 'notifications-dispatch-scheduled',
        requestId: executionId,
        typeKey: 'appointment.reminder_day',
        recipientUserId: null,
        relatedEntityType: 'appointment',
        relatedEntityId: appointment.id,
        deduplicationKey: `appointment:${appointment.id}:reminder_day:professional:unresolved`,
      }, error);
      summary.failed += 1;
    }
  }

  return summary;
}
