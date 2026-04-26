-- Temporary active prices for specialty-request appointments.
-- These rows do not replace historical generic specialty_request records.

INSERT INTO public.platform_service_prices (
  service_code,
  specialty_code,
  display_name,
  fee_group,
  gross_price,
  currency,
  active,
  metadata
)
SELECT
  'specialty_request',
  seed.specialty_code,
  seed.display_name,
  'specialty',
  seed.gross_price,
  'BRL',
  true,
  jsonb_build_object(
    'temporary_price', true,
    'source', 'specialty_request_price_seed_20260426'
  )
FROM (
  VALUES
    ('clinico_geral', 'Especialidade - Clinico Geral', 96.00),
    ('cardiologia', 'Especialidade - Cardiologia', 140.00),
    ('neurologia', 'Especialidade - Neurologia', 180.00),
    ('ortopedia', 'Especialidade - Ortopedia', 150.00),
    ('oftalmologia', 'Especialidade - Oftalmologia', 130.00),
    ('pediatria', 'Especialidade - Pediatria', 110.00),
    ('dermatologia', 'Especialidade - Dermatologia', 120.00),
    ('ginecologia', 'Especialidade - Ginecologia', 130.00),
    ('urologia', 'Especialidade - Urologia', 130.00),
    ('psiquiatria', 'Especialidade - Psiquiatria', 180.00),
    ('endocrinologia', 'Especialidade - Endocrinologia', 150.00),
    ('medicina_integrativa', 'Especialidade - Medicina Integrativa', 160.00),
    ('otorrinolaringologia', 'Especialidade - Otorrinolaringologia', 130.00),
    ('psicologia', 'Especialidade - Psicologia', 90.00),
    ('nutricao', 'Especialidade - Nutricao', 80.00),
    ('fonoaudiologia', 'Especialidade - Fonoaudiologia', 85.00)
) AS seed(specialty_code, display_name, gross_price)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.platform_service_prices existing
  WHERE existing.service_code = 'specialty_request'
    AND existing.specialty_code = seed.specialty_code
    AND existing.active = true
    AND existing.effective_to IS NULL
);
