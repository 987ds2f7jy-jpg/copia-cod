BEGIN;

DO $$
DECLARE
  target_table TEXT;
  policy_record RECORD;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'app_users',
    'patient_profiles',
    'professionals',
    'professional_profiles',
    'professional_public_profiles',
    'professional_banking_data',
    'professional_office_locations',
    'appointments',
    'availability_slots',
    'consultas',
    'mensagem_consulta',
    'avaliacao_consulta',
    'prontuarios',
    'questions',
    'queues',
    'reviews',
    'saques',
    'solicitacoes_exames',
    'platform_service_prices',
    'platform_fee_rules',
    'payment_charges',
    'payment_webhook_events',
    'zoom_webhook_events',
    'plan_subscription_orders',
    'plan_credit_usages',
    'home_banners'
  ]
  LOOP
    IF to_regclass(format('public.%I', target_table)) IS NULL THEN
      CONTINUE;
    END IF;

    FOR policy_record IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = target_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_record.policyname, target_table);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', target_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', target_table);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', target_table);
  END LOOP;
END
$$;

UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
WHERE id = 'uploads';

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        coalesce(qual, '') ILIKE '%uploads%'
        OR coalesce(with_check, '') ILIKE '%uploads%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_record.policyname);
  END LOOP;
END
$$;

REVOKE ALL ON TABLE storage.objects FROM anon, authenticated;
REVOKE ALL ON TABLE storage.buckets FROM anon, authenticated;
GRANT ALL ON TABLE storage.objects TO service_role;
GRANT ALL ON TABLE storage.buckets TO service_role;

ALTER FUNCTION public.finish_solicitacao_exame_atendimento_transaction(UUID, TEXT, TEXT, TEXT)
  SET search_path TO pg_catalog, public;

REVOKE ALL ON FUNCTION public.finish_solicitacao_exame_atendimento_transaction(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.finish_solicitacao_exame_atendimento_transaction(UUID, TEXT, TEXT, TEXT)
  TO service_role;

COMMIT;
