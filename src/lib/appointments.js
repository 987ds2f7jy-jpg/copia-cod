function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

const ACTIVE_APPOINTMENT_MAX_DURATION_MINUTES = 90;
const ACTIVE_APPOINTMENT_MAX_DURATION_MS = ACTIVE_APPOINTMENT_MAX_DURATION_MINUTES * 60 * 1000;

export function getAppointmentFlowType(record) {
  return normalizeValue(record?.appointment_type || record?.tipo_consulta);
}

export function isDutyAppointmentRecord(record) {
  const flowType = getAppointmentFlowType(record);
  return flowType === 'imediato' || flowType === 'instant' || flowType === 'plantao';
}

export function isCancelledAppointmentStatus(status) {
  const normalizedStatus = normalizeValue(status);
  return normalizedStatus === 'cancelado' || normalizedStatus === 'cancelled';
}

export function isCompletedAppointmentStatus(status) {
  const normalizedStatus = normalizeValue(status);
  return normalizedStatus === 'concluido' || normalizedStatus === 'completed';
}

function parseTimestamp(rawValue) {
  const normalized = String(rawValue || '').trim();

  if (!normalized) {
    return null;
  }

  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function buildFallbackDateTime(record) {
  const date = String(record?.date || '').trim();
  const time = String(record?.time || '').trim();

  if (!date) {
    return '';
  }

  return time ? `${date}T${time}` : `${date}T00:00:00`;
}

export function isStaleActiveAppointment(record, now = Date.now()) {
  const status = normalizeValue(record?.status);

  if (status !== 'in_progress' && status !== 'em_atendimento') {
    return false;
  }

  const anchorTimestamp =
    parseTimestamp(record?.started_at) ??
    parseTimestamp(record?.inicio_at) ??
    parseTimestamp(record?.accepted_at) ??
    parseTimestamp(record?.scheduled_datetime) ??
    parseTimestamp(record?.datetime) ??
    parseTimestamp(buildFallbackDateTime(record)) ??
    parseTimestamp(record?.updated_at) ??
    parseTimestamp(record?.created_date);

  if (anchorTimestamp == null) {
    return false;
  }

  return now - anchorTimestamp > ACTIVE_APPOINTMENT_MAX_DURATION_MS;
}
