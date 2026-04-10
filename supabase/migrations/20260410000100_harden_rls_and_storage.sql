-- Passo 5: hardening final de RLS e storage.
-- Estratégia:
-- 1) Remover policies permissivas "Allow all access".
-- 2) Aplicar FORCE ROW LEVEL SECURITY (deny-by-default sem policy de acesso público).
-- 3) Fechar bucket "uploads" para acesso direto por cliente.

DO $$
DECLARE
  target_table text;
  policy_record record;
BEGIN
  FOR target_table IN
    SELECT unnest(ARRAY[
      'app_users',
      'patient_profiles',
      'professionals',
      'professional_profiles',
      'professional_public_profiles',
      'professional_banking_data',
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
      'professional_office_locations',
      'queue'
    ])
  LOOP
    FOR policy_record IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = target_table
        AND lower(policyname) like 'allow all access%'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', policy_record.policyname, target_table);
    END LOOP;

    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY;', target_table);
    EXECUTE format('ALTER TABLE IF EXISTS public.%I FORCE ROW LEVEL SECURITY;', target_table);
  END LOOP;
END
$$;

-- Bucket privado: acesso apenas via service-role nas Edge Functions.
UPDATE storage.buckets
SET public = false
WHERE id = 'uploads';

DROP POLICY IF EXISTS "Anyone can read uploads" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update uploads" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete uploads" ON storage.objects;

-- Remove variações permissivas no storage.objects para bucket uploads.
DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        lower(policyname) like '%allow all access%'
        OR lower(policyname) like '%anyone can%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects;', policy_record.policyname);
  END LOOP;
END
$$;
