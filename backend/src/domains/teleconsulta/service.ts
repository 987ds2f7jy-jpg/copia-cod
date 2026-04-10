export function isConsultaJoinable(status: string) {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === 'aguardando' || normalized === 'em_atendimento' || normalized === 'in_progress';
}
