INSERT INTO public.notification_types (
  key,
  category,
  title_template,
  message_template
) VALUES (
  'plan.activation_failed',
  'plan',
  'Não foi possível ativar seu plano',
  'O pagamento foi confirmado, mas não foi possível concluir a ativação do seu plano. Tente novamente mais tarde ou entre em contato com o suporte.'
)
ON CONFLICT (key) DO NOTHING;

UPDATE public.notification_types
SET
  title_template = 'Lembrete de consulta',
  message_template = 'Você tem uma consulta hoje às {{appointment_time}}.'
WHERE key = 'appointment.reminder_day'
  AND (
    title_template IS DISTINCT FROM 'Lembrete de consulta'
    OR message_template IS DISTINCT FROM 'Você tem uma consulta hoje às {{appointment_time}}.'
  );
