ALTER TABLE public.solicitacoes_exames
  DROP CONSTRAINT IF EXISTS solicitacoes_exames_tipo_check;

ALTER TABLE public.solicitacoes_exames
  ADD CONSTRAINT solicitacoes_exames_tipo_check
  CHECK (tipo IN ('checkup', 'especificos', 'renovacao_receitas'));

DO $$
BEGIN
  ALTER TABLE public.solicitacoes_exames
    ADD CONSTRAINT solicitacoes_exames_renovacao_requires_fields
    CHECK (
      tipo <> 'renovacao_receitas'
      OR (
        btrim(coalesce(nome_medicamento, '')) <> ''
        AND btrim(coalesce(dosagem, '')) <> ''
        AND btrim(coalesce(frequencia, '')) <> ''
        AND btrim(coalesce(arquivo_receita_url, '')) <> ''
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
