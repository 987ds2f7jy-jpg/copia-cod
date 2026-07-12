BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
DECLARE
  current_schema TEXT;
  is_relocatable BOOLEAN;
BEGIN
  SELECT
    namespace.nspname,
    available.relocatable
  INTO current_schema, is_relocatable
  FROM pg_catalog.pg_extension AS ext
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = ext.extnamespace
  LEFT JOIN pg_catalog.pg_available_extension_versions AS available
    ON available.name = ext.extname
   AND available.version = ext.extversion
  WHERE ext.extname = 'unaccent';

  IF current_schema IS NULL THEN
    RAISE EXCEPTION 'UNACCENT_EXTENSION_NOT_INSTALLED';
  END IF;

  IF is_relocatable IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'UNACCENT_EXTENSION_NOT_RELOCATABLE';
  END IF;

  IF current_schema <> 'extensions' THEN
    EXECUTE 'ALTER EXTENSION unaccent SET SCHEMA extensions';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.normalize_plantao_specialty(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
  SELECT CASE
    WHEN v_normalized = 'psicologia_clinica' THEN 'psicologia'
    ELSE v_normalized
  END
  FROM (
    SELECT pg_catalog.regexp_replace(
      extensions.unaccent(pg_catalog.lower(pg_catalog.btrim(coalesce(p_value, '')))),
      '\s+',
      '_',
      'g'
    ) AS v_normalized
  ) AS normalized;
$$;

ALTER FUNCTION public.enforce_queue_payment_guard()
  SET search_path TO pg_catalog, public;

ALTER FUNCTION public.enforce_solicitacao_exame_payment_guard()
  SET search_path TO pg_catalog, public;

ALTER FUNCTION public.accept_appointment_transaction(UUID, TEXT, UUID)
  SET search_path TO pg_catalog, public;

ALTER FUNCTION public.accept_queue_entry_transaction(UUID, TEXT, UUID)
  SET search_path TO pg_catalog, public;

ALTER FUNCTION public.sync_consulta_profissional_user_id()
  SET search_path TO pg_catalog, public;

ALTER FUNCTION public.current_app_user_id()
  SET search_path TO pg_catalog, public;

ALTER FUNCTION public.current_app_user_role()
  SET search_path TO pg_catalog, public;

ALTER FUNCTION public.enforce_appointment_payment_guard()
  SET search_path TO pg_catalog, public;

COMMIT;
