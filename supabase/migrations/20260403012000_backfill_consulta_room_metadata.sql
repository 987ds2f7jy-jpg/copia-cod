UPDATE public.consultas
SET sala_id = CONCAT('consulta-', id)
WHERE COALESCE(sala_id, '') = '';

UPDATE public.consultas
SET token_sala = REPLACE(id::text, '-', '')
WHERE COALESCE(token_sala, '') = '';

CREATE INDEX IF NOT EXISTS idx_consultas_sala_id_lookup
ON public.consultas (sala_id);
