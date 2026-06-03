const REQUESTED_APPOINTMENT_STATUSES = new Set(['solicitado', 'requested', 'pending']);
const SPECIALTY_APPOINTMENT_TYPES = new Set(['especialidade']);
const DEFAULT_EXPIRATION_TOLERANCE_MINUTES = 10;
const APPOINTMENT_TIME_ZONE = 'America/Sao_Paulo';

export type AppointmentExpirationInput = {
  status?: unknown;
  appointmentType?: unknown;
  scheduledDatetime?: unknown;
  date?: unknown;
  time?: unknown;
  scheduledDate?: unknown;
  scheduledTime?: unknown;
};

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeComparable(value: unknown) {
  return normalizeString(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeDateTimeString(value: unknown) {
  const raw = normalizeString(value);

  if (!raw) {
    return '';
  }

  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? '' : formatAppointmentLocalDateTime(parsed);
  }

  const [datePart, timePart = '00:00:00'] = raw.replace(' ', 'T').split('T');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return '';
  }

  const normalizedTime = `${timePart}:00:00`.slice(0, 8);

  if (!/^\d{2}:\d{2}:\d{2}$/.test(normalizedTime)) {
    return '';
  }

  return `${datePart}T${normalizedTime}`;
}

function buildDateTimeFromParts(input: AppointmentExpirationInput) {
  const date = normalizeString(input.date) || normalizeString(input.scheduledDate);
  const time = normalizeString(input.time) || normalizeString(input.scheduledTime);

  if (!date || !time) {
    return '';
  }

  return normalizeDateTimeString(`${date}T${time}`);
}

export function resolveAppointmentScheduledComparable(input: AppointmentExpirationInput) {
  return (
    normalizeDateTimeString(input.scheduledDatetime) ||
    buildDateTimeFromParts(input)
  );
}

export function formatAppointmentLocalDateTime(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APPOINTMENT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const byType = new Map(parts.map((part) => [part.type, part.value]));
  const year = byType.get('year') || '0000';
  const month = byType.get('month') || '00';
  const day = byType.get('day') || '00';
  const hour = byType.get('hour') || '00';
  const minute = byType.get('minute') || '00';
  const second = byType.get('second') || '00';

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

export function getAppointmentExpirationCutoff(now = new Date()) {
  return formatAppointmentLocalDateTime(
    new Date(now.getTime() - DEFAULT_EXPIRATION_TOLERANCE_MINUTES * 60 * 1000),
  );
}

export function isSpecialtyAppointmentRequestExpired(
  input: AppointmentExpirationInput,
  now = new Date(),
) {
  const status = normalizeComparable(input.status);
  const appointmentType = normalizeComparable(input.appointmentType);

  if (!REQUESTED_APPOINTMENT_STATUSES.has(status) || !SPECIALTY_APPOINTMENT_TYPES.has(appointmentType)) {
    return false;
  }

  const scheduledAt = resolveAppointmentScheduledComparable(input);

  if (!scheduledAt) {
    return false;
  }

  return scheduledAt < getAppointmentExpirationCutoff(now);
}

export const APPOINTMENT_EXPIRED_ERROR = {
  code: 'APPOINTMENT_EXPIRED',
  message: 'Esta solicitação já passou do horário e não pode mais ser aceita.',
};
