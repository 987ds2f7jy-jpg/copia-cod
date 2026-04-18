-- Initial pricing catalog seed.
-- Platform service prices are intentionally inactive because real business prices were not defined yet.
-- Fee rules centralize the existing 15% platform fee that was previously hardcoded in frontend/backend reads.

INSERT INTO public.platform_service_prices (
  service_code,
  display_name,
  fee_group,
  gross_price,
  currency,
  active,
  metadata
)
SELECT
  seed.service_code,
  seed.display_name,
  seed.fee_group,
  0,
  'BRL',
  false,
  '{"placeholder":true,"requires_business_price":true}'::jsonb
FROM (
  VALUES
    ('on_duty_clinico_geral', 'Plantao - Clinico Geral', 'duty'),
    ('on_duty_pediatria', 'Plantao - Pediatria', 'duty'),
    ('on_duty_psicologia', 'Plantao - Psicologia', 'duty'),
    ('on_duty_psiquiatria', 'Plantao - Psiquiatria', 'duty'),
    ('specialty_request', 'Consulta por especialidade', 'specialty'),
    ('extra_checkup', 'Extra - Check-Up', 'services'),
    ('extra_exames_especificos', 'Extra - Exames especificos', 'services'),
    ('extra_renovacao_receitas', 'Extra - Renovacao de receitas', 'services'),
    ('extra_laudo_medico', 'Extra - Laudo medico', 'services')
) AS seed(service_code, display_name, fee_group)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.platform_service_prices existing
  WHERE existing.service_code = seed.service_code
    AND existing.effective_to IS NULL
);

INSERT INTO public.platform_fee_rules (
  fee_group,
  service_code,
  fee_percent,
  active,
  metadata
)
SELECT
  seed.fee_group,
  '',
  0.15,
  true,
  '{"source":"legacy_15_percent_default","initial_backend_source_of_truth":true}'::jsonb
FROM (
  VALUES
    ('profile'),
    ('duty'),
    ('specialty'),
    ('services')
) AS seed(fee_group)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.platform_fee_rules existing
  WHERE existing.fee_group = seed.fee_group
    AND existing.service_code = ''
    AND existing.effective_to IS NULL
);
