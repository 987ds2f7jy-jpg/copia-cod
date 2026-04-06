
CREATE TABLE public.solicitacoes_exames (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id TEXT NOT NULL,
  paciente_nome TEXT DEFAULT '',
  tipo TEXT NOT NULL CHECK (tipo IN ('checkup', 'especificos')),
  exame_solicitado TEXT DEFAULT '',
  motivo TEXT DEFAULT '',
  sintomas TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  assintomatico_confirmado BOOLEAN DEFAULT false,
  medico_id TEXT DEFAULT '',
  created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.solicitacoes_exames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON public.solicitacoes_exames
  FOR ALL TO public
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_solicitacoes_exames_updated_at
  BEFORE UPDATE ON public.solicitacoes_exames
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
