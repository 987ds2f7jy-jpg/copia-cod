ALTER TABLE public.solicitacoes_exames
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_solicitacoes_exames_accepted_at
  ON public.solicitacoes_exames (accepted_at DESC)
  WHERE accepted_at IS NOT NULL;
