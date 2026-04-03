export function mapAppointmentTypeToConsultaType(type) {
  if (type === 'priority' || type === 'prioritario') return 'prioritario';
  if (type === 'instant' || type === 'plantao' || type === 'IMEDIATO') return 'plantao';
  if (type === 'ESPECIALIDADE' || type === 'especialidade') return 'especialidade';
  return 'padrao';
}

export function buildConsultaFromAppointment(appointment, professional, overrides = {}) {
  const nowIso = new Date().toISOString();

  return {
    paciente_id: appointment.patient_id,
    paciente_nome: appointment.patient_name,
    paciente_email: appointment.patient_email || '',
    profissional_id: professional.id,
    profissional_nome: professional.full_name,
    especialidade: appointment.specialty,
    tipo_consulta: mapAppointmentTypeToConsultaType(appointment.appointment_type || appointment.tipo_consulta),
    status: 'aguardando',
    datetime: appointment.scheduled_datetime || appointment.datetime || nowIso,
    descricao_sintomas: appointment.symptoms || appointment.descricao_sintomas || '',
    preco: appointment.price || appointment.preco || professional.price_standard || 0,
    ...overrides,
  };
}

export function buildConsultaFromQueueEntry(queueEntry, professional) {
  const nowIso = new Date().toISOString();

  return {
    paciente_id: queueEntry.patient_id,
    paciente_nome: queueEntry.patient_name,
    paciente_email: queueEntry.patient_email || '',
    profissional_id: professional.id,
    profissional_nome: professional.full_name,
    especialidade: queueEntry.specialty,
    tipo_consulta: 'plantao',
    status: 'em_atendimento',
    datetime: nowIso,
    descricao_sintomas: queueEntry.symptoms || '',
    preco: professional.price_standard || 0,
    inicio_at: nowIso,
  };
}

export function isConsultaParticipant(consulta, userId) {
  if (!consulta || !userId) return false;
  return consulta.profissional_id === userId || consulta.paciente_id === userId;
}
