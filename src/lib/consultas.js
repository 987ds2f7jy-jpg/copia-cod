export function getConsultaParticipantIds(consulta) {
  if (!consulta) return [];

  return [
    consulta.paciente_id,
    consulta.profissional_id,
    consulta.profissional_user_id,
  ].filter(Boolean);
}

export function isConsultaParticipant(consulta, participantIds) {
  if (!consulta || !participantIds) return false;

  const currentIds = Array.isArray(participantIds) ? participantIds : [participantIds];
  const validParticipantIds = currentIds.filter(Boolean);

  if (validParticipantIds.length === 0) {
    return false;
  }

  const consultaParticipantIds = getConsultaParticipantIds(consulta);
  return validParticipantIds.some((id) => consultaParticipantIds.includes(id));
}
