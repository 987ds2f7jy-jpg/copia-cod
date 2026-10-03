INSERT INTO public.notification_types (
  key,
  category,
  title_template,
  message_template
) VALUES
  (
    'plan.credit_reserved',
    'plan',
    'Crédito reservado',
    'Seu crédito do plano foi reservado para este atendimento.'
  ),
  (
    'plan.coverage_denied',
    'plan',
    'Cobertura indisponível',
    'Seu plano não possui cobertura disponível para este atendimento.'
  ),
  (
    'plan.expiring',
    'plan',
    'Plano próximo do vencimento',
    'Seu plano está próximo do vencimento.'
  ),
  (
    'plan.expired',
    'plan',
    'Plano expirado',
    'Seu plano expirou.'
  ),
  (
    'plan.cancelled',
    'plan',
    'Plano cancelado',
    'Seu plano foi cancelado.'
  )
ON CONFLICT (key) DO NOTHING;
