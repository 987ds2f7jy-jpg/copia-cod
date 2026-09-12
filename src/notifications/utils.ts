export function notificationDestination(notification) {
  const type = notification?.relatedEntityType;
  const id = notification?.relatedEntityId;
  // Appointment ownership has different dashboards per role; keep it in the
  // notification center until a role-aware destination is supplied.
  if (type === 'appointment') return null;
  if (type === 'consulta' && id) return `/consulta/${id}`;
  if (type === 'payment_charge') return '/MeusPagamentos';
  if (type === 'plan') return '/MeusPlanos';
  if (type === 'clinical_request') return '/SolicitacaoExames';
  return null;
}
