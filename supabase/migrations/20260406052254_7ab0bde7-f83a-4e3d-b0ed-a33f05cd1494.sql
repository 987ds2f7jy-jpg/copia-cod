ALTER TABLE public.solicitacoes_exames
  ADD COLUMN IF NOT EXISTS nome_medicamento text DEFAULT '',
  ADD COLUMN IF NOT EXISTS dosagem text DEFAULT '',
  ADD COLUMN IF NOT EXISTS frequencia text DEFAULT '',
  ADD COLUMN IF NOT EXISTS arquivo_receita_url text DEFAULT '';