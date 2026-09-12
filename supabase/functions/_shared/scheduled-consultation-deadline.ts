export const SCHEDULED_CONSULTATION_LATE_START_ALLOWANCE_MINUTES = 30;

const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';
const TERMINAL_STATUSES = new Set(['finalizada', 'cancelada', 'nao_realizada']);
const STARTABLE_STATUS = 'aguardando';

export type ScheduledConsultationDeadlineState =
  | 'not_scheduled'
  | 'terminal'
  | 'started'
  | 'unsupported_status'
  | 'invalid_schedule'
  | 'before_start'
  | 'within_start_window'
  | 'deadline_elapsed';

export type ScheduledConsultationDeadline = {
  state: ScheduledConsultationDeadlineState;
  scheduledAt: string | null;
  deadlineAt: string | null;
  serverNow: string;
  canStart: boolean;
  effectivelyExpired: boolean;
};

function text(value: unknown) {
  return String(value ?? '').trim();
}

function isImmediateConsultation(type: unknown) {
  return ['plantao', 'instant', 'imediato'].includes(text(type).toLowerCase());
}

function hasOffset(value: string) {
  return /(?:z|[+-]\d{2}:?\d{2})$/i.test(value);
}

function getTimeZoneOffsetMs(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const localAsUtc = Date.UTC(
    Number(values.get('year')),
    Number(values.get('month')) - 1,
    Number(values.get('day')),
    Number(values.get('hour')),
    Number(values.get('minute')),
    Number(values.get('second')),
  );

  return localAsUtc - date.getTime();
}

/**
 * Offset-bearing values represent an instant. Legacy offset-free values are wall
 * times in America/Sao_Paulo, matching the existing appointment acceptance rule.
 */
export function parseScheduledConsultationTimestamp(value: unknown): Date | null {
  const raw = text(value);

  if (!raw) return null;

  if (hasOffset(raw)) {
    const timestamp = Date.parse(raw);
    return Number.isFinite(timestamp) ? new Date(timestamp) : null;
  }

  const match = raw.replace(' ', 'T').match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/,
  );
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '0', millisecondsText = '0'] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const milliseconds = Number(millisecondsText.padEnd(3, '0'));
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, milliseconds);
  const wallClock = new Date(wallClockAsUtc);

  if (
    wallClock.getUTCFullYear() !== year ||
    wallClock.getUTCMonth() !== month - 1 ||
    wallClock.getUTCDate() !== day ||
    wallClock.getUTCHours() !== hour ||
    wallClock.getUTCMinutes() !== minute ||
    wallClock.getUTCSeconds() !== second
  ) {
    return null;
  }

  // Re-evaluate once so this remains correct if the timezone offset changes at
  // the resolved instant (for example, around a historical DST transition).
  let instant = new Date(wallClockAsUtc - getTimeZoneOffsetMs(wallClock));
  instant = new Date(wallClockAsUtc - getTimeZoneOffsetMs(instant));
  return Number.isFinite(instant.getTime()) ? instant : null;
}

export function resolveScheduledAppointmentDateTime(input: {
  scheduled_datetime?: unknown;
  date?: unknown;
  time?: unknown;
}) {
  const explicit = text(input.scheduled_datetime);
  if (explicit) return explicit;

  const date = text(input.date);
  const time = text(input.time);
  return date && time ? `${date}T${time}` : '';
}

export function getScheduledConsultationDeadline(
  consultation: {
    tipo_consulta?: unknown;
    status?: unknown;
    datetime?: unknown;
    inicio_at?: unknown;
  },
  now = new Date(),
): ScheduledConsultationDeadline {
  const serverNow = now.toISOString();
  const status = text(consultation.status).toLowerCase();

  if (isImmediateConsultation(consultation.tipo_consulta)) {
    return { state: 'not_scheduled', scheduledAt: null, deadlineAt: null, serverNow, canStart: true, effectivelyExpired: false };
  }

  if (TERMINAL_STATUSES.has(status)) {
    return { state: 'terminal', scheduledAt: null, deadlineAt: null, serverNow, canStart: false, effectivelyExpired: false };
  }

  // A non-empty actual-start field is evidence of care/session activity even if
  // legacy data is malformed. It must never be auto-classified as not performed.
  if (text(consultation.inicio_at)) {
    return { state: 'started', scheduledAt: null, deadlineAt: null, serverNow, canStart: false, effectivelyExpired: false };
  }

  if (status !== STARTABLE_STATUS) {
    return { state: 'unsupported_status', scheduledAt: null, deadlineAt: null, serverNow, canStart: false, effectivelyExpired: false };
  }

  const scheduled = parseScheduledConsultationTimestamp(consultation.datetime);
  if (!scheduled) {
    return { state: 'invalid_schedule', scheduledAt: null, deadlineAt: null, serverNow, canStart: false, effectivelyExpired: false };
  }

  const deadline = new Date(
    scheduled.getTime() + SCHEDULED_CONSULTATION_LATE_START_ALLOWANCE_MINUTES * 60 * 1000,
  );
  const scheduledAt = scheduled.toISOString();
  const deadlineAt = deadline.toISOString();

  if (now.getTime() < scheduled.getTime()) {
    return { state: 'before_start', scheduledAt, deadlineAt, serverNow, canStart: false, effectivelyExpired: false };
  }

  if (now.getTime() <= deadline.getTime()) {
    return { state: 'within_start_window', scheduledAt, deadlineAt, serverNow, canStart: true, effectivelyExpired: false };
  }

  return { state: 'deadline_elapsed', scheduledAt, deadlineAt, serverNow, canStart: false, effectivelyExpired: true };
}

export function isNeverStartedScheduledConsultationExpired(
  consultation: Parameters<typeof getScheduledConsultationDeadline>[0],
  now = new Date(),
) {
  return getScheduledConsultationDeadline(consultation, now).effectivelyExpired;
}

export function getScheduledAppointmentDeadline(
  appointment: {
    appointment_type?: unknown;
    status?: unknown;
    scheduled_datetime?: unknown;
    date?: unknown;
    time?: unknown;
  },
  now = new Date(),
) {
  return getScheduledConsultationDeadline({
    tipo_consulta: appointment.appointment_type,
    status: ['accepted', 'confirmed', 'CONFIRMADO'].includes(text(appointment.status))
      ? 'aguardando'
      : appointment.status,
    datetime: resolveScheduledAppointmentDateTime(appointment),
    inicio_at: null,
  }, now);
}
