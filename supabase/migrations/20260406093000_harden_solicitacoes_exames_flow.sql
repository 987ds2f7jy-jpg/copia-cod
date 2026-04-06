ALTER TABLE public.solicitacoes_exames
  ADD COLUMN IF NOT EXISTS fluxo_destino TEXT NOT NULL DEFAULT 'dashboard',
  ADD COLUMN IF NOT EXISTS especialidade_destino TEXT NOT NULL DEFAULT 'clinico_geral',
  ADD COLUMN IF NOT EXISTS paciente_email TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS paciente_telefone TEXT DEFAULT '';

DO $$
BEGIN
  ALTER TABLE public.solicitacoes_exames
    ADD CONSTRAINT solicitacoes_exames_fluxo_destino_check
    CHECK (fluxo_destino IN ('dashboard', 'plantao'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.solicitacoes_exames
    ADD CONSTRAINT solicitacoes_exames_checkup_requires_assintomatico
    CHECK (tipo <> 'checkup' OR assintomatico_confirmado = true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.solicitacoes_exames
    ADD CONSTRAINT solicitacoes_exames_checkup_uses_dashboard
    CHECK (tipo <> 'checkup' OR fluxo_destino = 'dashboard');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.solicitacoes_exames
    ADD CONSTRAINT solicitacoes_exames_especificos_uses_plantao
    CHECK (tipo <> 'especificos' OR fluxo_destino = 'plantao');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.solicitacoes_exames
    ADD CONSTRAINT solicitacoes_exames_especificos_require_exame
    CHECK (tipo <> 'especificos' OR btrim(coalesce(exame_solicitado, '')) <> '');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_solicitacoes_exames_status_destino
  ON public.solicitacoes_exames (status, fluxo_destino, especialidade_destino, created_date DESC);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_exames_paciente
  ON public.solicitacoes_exames (paciente_id, created_date DESC);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_exames_medico_status
  ON public.solicitacoes_exames (medico_id, status, created_date DESC);
