
ALTER TABLE public.solicitacoes_exames
  DROP CONSTRAINT IF EXISTS solicitacoes_exames_tipo_check;

ALTER TABLE public.solicitacoes_exames
  ADD CONSTRAINT solicitacoes_exames_tipo_check
  CHECK (tipo IN ('checkup', 'especificos', 'renovacao_receitas', 'laudo_medico'));

ALTER TABLE public.solicitacoes_exames
  ADD COLUMN IF NOT EXISTS dados_saude jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS especificacao_laudo jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS arquivos_urls text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS paciente_email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS paciente_telefone text DEFAULT '';
