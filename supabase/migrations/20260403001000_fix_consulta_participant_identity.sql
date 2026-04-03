ALTER TABLE public.consultas
ADD COLUMN IF NOT EXISTS profissional_user_id TEXT DEFAULT '';

UPDATE public.consultas AS consultas
SET profissional_user_id = COALESCE(NULLIF(profiles.user_id, ''), consultas.profissional_id)
FROM public.professional_profiles AS profiles
WHERE consultas.profissional_id = profiles.id
  AND COALESCE(consultas.profissional_user_id, '') = '';

UPDATE public.consultas
SET profissional_user_id = profissional_id
WHERE COALESCE(profissional_user_id, '') = '';

CREATE INDEX IF NOT EXISTS idx_consultas_profissional_user_status
ON public.consultas (profissional_user_id, status);

CREATE OR REPLACE FUNCTION public.sync_consulta_profissional_user_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.profissional_user_id, '') = '' THEN
    SELECT COALESCE(NULLIF(profiles.user_id, ''), NEW.profissional_id)
      INTO NEW.profissional_user_id
    FROM public.professional_profiles AS profiles
    WHERE profiles.id = NEW.profissional_id
    LIMIT 1;

    IF COALESCE(NEW.profissional_user_id, '') = '' THEN
      NEW.profissional_user_id := NEW.profissional_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_consulta_profissional_user_id ON public.consultas;

CREATE TRIGGER set_consulta_profissional_user_id
BEFORE INSERT OR UPDATE OF profissional_id, profissional_user_id
ON public.consultas
FOR EACH ROW
EXECUTE FUNCTION public.sync_consulta_profissional_user_id();
