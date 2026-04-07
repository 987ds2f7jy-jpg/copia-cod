ALTER TABLE public.solicitacoes_exames
  ADD COLUMN IF NOT EXISTS dados_identificacao jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS informacoes_saude jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS arquivos text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS queue_id text DEFAULT '';

ALTER TABLE public.queues
  ADD COLUMN IF NOT EXISTS solicitacao_exame_id text DEFAULT '';

UPDATE public.solicitacoes_exames
SET
  informacoes_saude = CASE
    WHEN informacoes_saude = '{}'::jsonb THEN COALESCE(dados_saude, '{}'::jsonb)
    ELSE informacoes_saude
  END,
  arquivos = CASE
    WHEN COALESCE(array_length(arquivos, 1), 0) = 0 THEN COALESCE(arquivos_urls, '{}'::text[])
    ELSE arquivos
  END
WHERE tipo = 'laudo_medico';

CREATE INDEX IF NOT EXISTS idx_solicitacoes_exames_tipo_status_created
  ON public.solicitacoes_exames (tipo, status, created_date DESC);

CREATE INDEX IF NOT EXISTS idx_queues_specialty_status_created
  ON public.queues (specialty, status, created_date DESC);

CREATE INDEX IF NOT EXISTS idx_queues_solicitacao_exame_id
  ON public.queues (solicitacao_exame_id);
