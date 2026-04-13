function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

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
