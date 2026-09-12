BEGIN;

CREATE TABLE IF NOT EXISTS public.notification_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  title_template TEXT NOT NULL,
  message_template TEXT NOT NULL,
  default_channels JSONB NOT NULL DEFAULT '["internal"]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_types_key_nonempty CHECK (length(trim(key)) > 0),
  CONSTRAINT notification_types_category_valid CHECK (category IN ('appointment', 'financial', 'review', 'clinical_request', 'professional', 'plan', 'queue', 'teleconsulta', 'system')),
  CONSTRAINT notification_types_title_nonempty CHECK (length(trim(title_template)) > 0),
  CONSTRAINT notification_types_message_nonempty CHECK (length(trim(message_template)) > 0),
  CONSTRAINT notification_types_channels_array CHECK (jsonb_typeof(default_channels) = 'array')
);

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  notification_type_id UUID NOT NULL REFERENCES public.notification_types(id) ON DELETE RESTRICT,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  related_entity_type TEXT,
  related_entity_id UUID,
  deduplication_key TEXT UNIQUE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  CONSTRAINT user_notifications_category_valid CHECK (category IN ('appointment', 'financial', 'review', 'clinical_request', 'professional', 'plan', 'queue', 'teleconsulta', 'system')),
  CONSTRAINT user_notifications_title_nonempty CHECK (length(trim(title)) > 0),
  CONSTRAINT user_notifications_message_nonempty CHECK (length(trim(message)) > 0),
  CONSTRAINT user_notifications_data_object CHECK (jsonb_typeof(data) = 'object')
);

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_notification_id UUID NOT NULL REFERENCES public.user_notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_deliveries_channel_valid CHECK (channel IN ('internal', 'email', 'whatsapp', 'sms', 'push', 'gateway')),
  CONSTRAINT notification_deliveries_status_valid CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  CONSTRAINT notification_deliveries_attempt_count_valid CHECK (attempt_count >= 0),
  CONSTRAINT notification_deliveries_one_channel UNIQUE (user_notification_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient_created_at
  ON public.user_notifications (recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient_unread
  ON public.user_notifications (recipient_user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_notification
  ON public.notification_deliveries (user_notification_id, channel);

ALTER TABLE public.notification_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_types FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notification_types, public.user_notifications, public.notification_deliveries FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.notification_types, public.user_notifications, public.notification_deliveries TO service_role;

DROP TRIGGER IF EXISTS update_notification_types_updated_at ON public.notification_types;
CREATE TRIGGER update_notification_types_updated_at BEFORE UPDATE ON public.notification_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_notification_deliveries_updated_at ON public.notification_deliveries;
CREATE TRIGGER update_notification_deliveries_updated_at BEFORE UPDATE ON public.notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.notification_types (key, category, title_template, message_template) VALUES
  ('appointment.created', 'appointment', 'Agendamento realizado', 'Seu agendamento foi criado.'),
  ('appointment.received', 'appointment', 'Novo agendamento', 'Você recebeu um novo agendamento.'),
  ('appointment.accepted', 'appointment', 'Agendamento aceito', 'Seu agendamento com {{professional_name}} foi aceito.'),
  ('appointment.cancelled', 'appointment', 'Agendamento cancelado', 'Um agendamento foi cancelado.'),
  ('appointment.reminder_day', 'appointment', 'Lembrete de consulta', 'Você tem uma consulta agendada para hoje.'),
  ('appointment.reminder_1h', 'appointment', 'Lembrete de consulta', 'Sua consulta começa em aproximadamente uma hora.'),
  ('appointment.reminder_10m', 'appointment', 'Consulta em breve', 'Sua consulta começa em aproximadamente dez minutos.'),
  ('appointment.starting', 'appointment', 'Consulta disponível', 'Sua consulta já pode ser iniciada.'),
  ('financial.payment_created', 'financial', 'Cobrança criada', 'Uma cobrança foi criada para você.'),
  ('financial.payment_approved', 'financial', 'Pagamento aprovado', 'Seu pagamento foi aprovado.'),
  ('financial.payment_failed', 'financial', 'Pagamento não aprovado', 'Não foi possível confirmar seu pagamento.'),
  ('financial.payment_expired', 'financial', 'Cobrança expirada', 'Uma cobrança expirou.'),
  ('financial.refund_processed', 'financial', 'Reembolso processado', 'Seu reembolso foi processado.'),
  ('financial.professional_revenue_available', 'financial', 'Receita disponível', 'Um valor está disponível no seu saldo profissional.'),
  ('financial.withdrawal_requested', 'financial', 'Saque solicitado', 'Sua solicitação de saque foi registrada.'),
  ('financial.withdrawal_paid', 'financial', 'Saque pago', 'Seu saque foi pago.'),
  ('financial.withdrawal_rejected', 'financial', 'Saque não aprovado', 'Sua solicitação de saque não foi aprovada.'),
  ('review.professional_pending', 'review', 'Avalie seu atendimento', 'Sua avaliação do atendimento está disponível.'),
  ('review.received', 'review', 'Nova avaliação', 'Você recebeu uma nova avaliação.'),
  ('clinical_request.created', 'clinical_request', 'Solicitação criada', 'Sua solicitação clínica foi criada.'),
  ('clinical_request.accepted', 'clinical_request', 'Solicitação atualizada', 'Sua solicitação clínica foi aceita.'),
  ('clinical_request.rejected', 'clinical_request', 'Solicitação atualizada', 'Sua solicitação clínica não foi aceita.'),
  ('clinical_request.completed', 'clinical_request', 'Solicitação concluída', 'Sua solicitação clínica foi concluída.'),
  ('clinical_request.document_available', 'clinical_request', 'Documento disponível', 'Um documento da sua solicitação está disponível.'),
  ('professional.registration_submitted', 'professional', 'Cadastro enviado', 'Seu cadastro profissional foi enviado para análise.'),
  ('professional.registration_approved', 'professional', 'Cadastro aprovado', 'Seu cadastro profissional foi aprovado.'),
  ('professional.registration_rejected', 'professional', 'Cadastro atualizado', 'Seu cadastro profissional não foi aprovado.'),
  ('professional.profile_published', 'professional', 'Perfil publicado', 'Seu perfil profissional foi publicado.'),
  ('professional.profile_suspended', 'professional', 'Perfil suspenso', 'Seu perfil profissional foi suspenso.'),
  ('plan.activated', 'plan', 'Plano ativado', 'Seu plano foi ativado.'),
  ('plan.expiring', 'plan', 'Plano próximo do vencimento', 'Seu plano está próximo do vencimento.'),
  ('plan.expired', 'plan', 'Plano expirado', 'Seu plano expirou.'),
  ('plan.cancelled', 'plan', 'Plano cancelado', 'Seu plano foi cancelado.'),
  ('plan.credit_reserved', 'plan', 'Crédito reservado', 'Um crédito do seu plano foi reservado.'),
  ('plan.credit_consumed', 'plan', 'Crédito utilizado', 'Um crédito do seu plano foi utilizado.'),
  ('plan.coverage_denied', 'plan', 'Cobertura indisponível', 'Não foi possível aplicar a cobertura do plano.'),
  ('queue.joined', 'queue', 'Entrada na fila', 'Você entrou na fila de atendimento.'),
  ('queue.request_received', 'queue', 'Novo atendimento na fila', 'Há uma nova solicitação de atendimento na fila.'),
  ('queue.accepted', 'queue', 'Atendimento aceito', 'Seu atendimento imediato foi aceito.'),
  ('queue.expired', 'queue', 'Fila expirada', 'Sua entrada na fila expirou.'),
  ('queue.cancelled', 'queue', 'Fila cancelada', 'Sua entrada na fila foi cancelada.'),
  ('teleconsulta.room_available', 'teleconsulta', 'Sala disponível', 'A sala da sua teleconsulta está disponível.'),
  ('teleconsulta.started', 'teleconsulta', 'Teleconsulta iniciada', 'Sua teleconsulta foi iniciada.'),
  ('teleconsulta.finished', 'teleconsulta', 'Teleconsulta concluída', 'Sua teleconsulta foi concluída.'),
  ('teleconsulta.record_available', 'teleconsulta', 'Registro disponível', 'Um registro da teleconsulta está disponível.'),
  ('system.general', 'system', 'Atualização do sistema', 'Você recebeu uma nova atualização.')
ON CONFLICT (key) DO NOTHING;

COMMIT;
