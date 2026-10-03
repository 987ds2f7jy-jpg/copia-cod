-- Run against a disposable local database after all migrations.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO extensions, public;
SELECT plan(30);

INSERT INTO public.app_users (id, full_name, email, password_hash, role) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Patient One', 'atomic-patient-1@example.invalid', 'test', 'patient'),
  ('10000000-0000-0000-0000-000000000002', 'Patient Two', 'atomic-patient-2@example.invalid', 'test', 'patient'),
  ('20000000-0000-0000-0000-000000000001', 'Professional One', 'atomic-professional-1@example.invalid', 'test', 'professional'),
  ('20000000-0000-0000-0000-000000000002', 'Professional Two', 'atomic-professional-2@example.invalid', 'test', 'professional');

INSERT INTO public.professional_profiles
  (id, user_id, full_name, profession, specialty, register_number, register_state, status, is_on_duty)
VALUES
  ('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'Professional One', 'medico', 'clinico_geral', 'atomic-1', 'SP', 'approved', true),
  ('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002',
   'Professional Two', 'medico', 'clinico_geral', 'atomic-2', 'SP', 'approved', true);

INSERT INTO public.plan_subscription_orders (id, plan_code, amount, currency, external_key, plans_backend)
VALUES ('11000000-0000-0000-0000-000000000001', 'weight_loss', 100, 'BRL', 'atomic-patient-1@example.invalid', 'internal');
INSERT INTO public.payment_charges (id, owner_type, owner_id, attempt_number, status, amount, currency)
VALUES ('12000000-0000-0000-0000-000000000001', 'plan_subscription',
  '11000000-0000-0000-0000-000000000001', 1, 'paid', 100, 'BRL');
INSERT INTO public.plan_subscriptions
  (id, plan_id, plan_subscription_order_id, payment_charge_id, external_key, status)
SELECT '13000000-0000-0000-0000-000000000001', id,
  '11000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001',
  'atomic-patient-1@example.invalid', 1
FROM public.plan_catalog WHERE code = 'weight_loss';
UPDATE public.plan_subscription_orders
SET internal_plans_subscription_id = '13000000-0000-0000-0000-000000000001'
WHERE id = '11000000-0000-0000-0000-000000000001';
INSERT INTO public.plan_subscription_scores
  (id, subscription_id, score_id, status, grant_period, allocation_sequence, grant_source)
SELECT ('23000000-0000-0000-0000-00000000000' || seq)::UUID,
  '13000000-0000-0000-0000-000000000001', score.id, 1, current_date, seq, 'activation'
FROM generate_series(1, 4) AS seq
CROSS JOIN LATERAL (SELECT id FROM public.plan_scores LIMIT 1) AS score;

INSERT INTO public.appointments
  (id, patient_id, patient_name, professional_id, specialty, appointment_type, scheduled_datetime,
   status, price, service_code, gross_price, payment_required, funding_source, coverage_status)
VALUES
  ('41000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'Patient One', '', 'clinico_geral', 'especialidade', '2099-01-01T12:00:00', 'requested', 100,
   'specialty_request', 100, false, 'plan', 'plan_pending_use'),
  ('41000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   'Patient One', '', 'clinico_geral', 'especialidade', '2099-01-02T12:00:00', 'requested', 0,
   'specialty_request', 0, false, 'plan', 'plan_pending_use');

INSERT INTO public.queues
  (id, patient_id, patient_name, specialty, status, service_code, price_source,
   quoted_gross_price, quoted_platform_fee_percent, quoted_platform_fee_amount,
   quoted_professional_net_amount, pricing_rule_id, fee_rule_id, payment_status,
   payment_required, funding_source, coverage_status)
SELECT '51000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  'Patient One', 'clinico_geral', 'waiting', 'on_duty_clinico_geral', 'platform_fixed',
  100, 0.1, 10, 90, (SELECT id FROM public.platform_service_prices LIMIT 1),
  (SELECT id FROM public.platform_fee_rules LIMIT 1), 'payment_pending', false, 'plan', 'plan_pending_use';
INSERT INTO public.queues
  (id, patient_id, patient_name, specialty, status, service_code, price_source,
   quoted_gross_price, quoted_platform_fee_percent, quoted_platform_fee_amount,
   quoted_professional_net_amount, pricing_rule_id, fee_rule_id, payment_status,
   payment_required, funding_source, coverage_status)
SELECT '51000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002',
  'Patient Two', 'clinico_geral', 'waiting', '', 'platform_fixed',
  100, 0.1, 10, 90, (SELECT id FROM public.platform_service_prices LIMIT 1),
  (SELECT id FROM public.platform_fee_rules LIMIT 1), 'payment_pending', false, 'plan', 'plan_pending_use';

INSERT INTO public.plan_credit_usages
  (id, patient_id, owner_type, owner_id, appointment_id, status, plans_backend, internal_subscription_score_id)
VALUES
  ('31000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'appointment', '41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001',
   'pending_use', 'internal', '23000000-0000-0000-0000-000000000001'),
  ('31000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   'appointment', '41000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000002',
   'pending_use', 'internal', '23000000-0000-0000-0000-000000000002'),
  ('31000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
   'queue', '51000000-0000-0000-0000-000000000001', NULL,
   'pending_use', 'internal', '23000000-0000-0000-0000-000000000003'),
  ('31000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002',
   'queue', '51000000-0000-0000-0000-000000000002', NULL,
   'pending_use', 'internal', '23000000-0000-0000-0000-000000000004');
UPDATE public.appointments SET plan_credit_usage_id = CASE id
  WHEN '41000000-0000-0000-0000-000000000001' THEN '31000000-0000-0000-0000-000000000001'::UUID
  ELSE '31000000-0000-0000-0000-000000000002'::UUID END
WHERE id IN ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000002');
UPDATE public.queues SET plan_credit_usage_id = CASE id
  WHEN '51000000-0000-0000-0000-000000000001' THEN '31000000-0000-0000-0000-000000000003'::UUID
  ELSE '31000000-0000-0000-0000-000000000004'::UUID END
WHERE id IN ('51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000002');

SELECT is((public.accept_internal_plan_appointment_transaction(
  '41000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  '21000000-0000-0000-0000-000000000001')->>'accepted_now'), 'true', 'appointment accepted now');
SELECT is((SELECT status FROM public.appointments WHERE id = '41000000-0000-0000-0000-000000000001'), 'accepted', 'appointment accepted');
SELECT is((SELECT status FROM public.plan_subscription_scores WHERE id = '23000000-0000-0000-0000-000000000001'), 2::smallint, 'appointment score used');
SELECT is((SELECT status FROM public.plan_credit_usages WHERE id = '31000000-0000-0000-0000-000000000001'), 'used', 'appointment usage used');
SELECT is((SELECT coverage_status FROM public.appointments WHERE id = '41000000-0000-0000-0000-000000000001'), 'plan_used', 'appointment coverage used');
SELECT is((SELECT count(*) FROM public.consultas WHERE id::TEXT = (SELECT consulta_id FROM public.appointments WHERE id = '41000000-0000-0000-0000-000000000001')), 1::bigint, 'appointment consulta exists');
SELECT is((public.accept_internal_plan_appointment_transaction(
  '41000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  '21000000-0000-0000-0000-000000000001')->>'accepted_now'), 'false', 'appointment replay');
SELECT throws_ok($$SELECT public.accept_internal_plan_appointment_transaction(
  '41000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
  '21000000-0000-0000-0000-000000000002')$$, 'P0001', 'PROFESSIONAL_PROFILE_MISMATCH', 'competing professional loses');
SELECT is((SELECT count(*) FROM public.consultas WHERE id::TEXT = (SELECT consulta_id FROM public.appointments WHERE id = '41000000-0000-0000-0000-000000000001')), 1::bigint, 'appointment replay created no consultation');

SELECT throws_ok($$SELECT public.accept_internal_plan_appointment_transaction(
  '41000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
  '21000000-0000-0000-0000-000000000001')$$, 'P0001', 'APPOINTMENT_PRICING_SNAPSHOT_REQUIRED', 'appointment failure after credit step');
SELECT is((SELECT status FROM public.plan_subscription_scores WHERE id = '23000000-0000-0000-0000-000000000002'), 1::smallint, 'appointment rollback restores score');
SELECT is((SELECT status FROM public.plan_credit_usages WHERE id = '31000000-0000-0000-0000-000000000002'), 'pending_use', 'appointment rollback restores usage');
SELECT is((SELECT status FROM public.appointments WHERE id = '41000000-0000-0000-0000-000000000002'), 'requested', 'appointment rollback restores owner');
SELECT is((SELECT coverage_status FROM public.appointments WHERE id = '41000000-0000-0000-0000-000000000002'), 'plan_pending_use', 'appointment rollback restores coverage');
SELECT is((SELECT count(*) FROM public.consultas WHERE paciente_id = '10000000-0000-0000-0000-000000000001' AND datetime = '2099-01-02T12:00:00'), 0::bigint, 'appointment rollback creates no consulta');

SELECT is((public.accept_internal_plan_queue_entry_transaction(
  '51000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
  '21000000-0000-0000-0000-000000000002')->>'accepted_now'), 'true', 'queue accepted now');
SELECT is((SELECT status FROM public.queues WHERE id = '51000000-0000-0000-0000-000000000001'), 'assigned', 'queue assigned');
SELECT is((SELECT status FROM public.plan_subscription_scores WHERE id = '23000000-0000-0000-0000-000000000003'), 2::smallint, 'queue score used');
SELECT is((SELECT status FROM public.plan_credit_usages WHERE id = '31000000-0000-0000-0000-000000000003'), 'used', 'queue usage used');
SELECT is((SELECT coverage_status FROM public.queues WHERE id = '51000000-0000-0000-0000-000000000001'), 'plan_used', 'queue coverage used');
SELECT is((SELECT count(*) FROM public.appointments WHERE plan_credit_usage_id = '31000000-0000-0000-0000-000000000003' AND consulta_id IS NOT NULL), 1::bigint, 'queue consultation and appointment linked');
SELECT is((public.accept_internal_plan_queue_entry_transaction(
  '51000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
  '21000000-0000-0000-0000-000000000002')->>'accepted_now'), 'false', 'queue replay');
SELECT is((SELECT count(*) FROM public.appointments WHERE plan_credit_usage_id = '31000000-0000-0000-0000-000000000003'), 1::bigint, 'queue replay creates no second linked appointment');
SELECT throws_ok($$SELECT public.accept_internal_plan_queue_entry_transaction(
  '51000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  '21000000-0000-0000-0000-000000000001')$$, 'P0001', 'QUEUE_ALREADY_ASSIGNED', 'competing queue professional loses');
SELECT throws_ok($$SELECT public.accept_internal_plan_queue_entry_transaction(
  '51000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002',
  '21000000-0000-0000-0000-000000000002')$$, 'P0001', 'QUEUE_PRICING_SNAPSHOT_REQUIRED', 'queue failure after credit step');
SELECT is((SELECT status FROM public.plan_subscription_scores WHERE id = '23000000-0000-0000-0000-000000000004'), 1::smallint, 'queue rollback restores score');
SELECT is((SELECT status FROM public.plan_credit_usages WHERE id = '31000000-0000-0000-0000-000000000004'), 'pending_use', 'queue rollback restores usage');
SELECT is((SELECT status FROM public.queues WHERE id = '51000000-0000-0000-0000-000000000002'), 'waiting', 'queue rollback restores owner');
SELECT is((SELECT coverage_status FROM public.queues WHERE id = '51000000-0000-0000-0000-000000000002'), 'plan_pending_use', 'queue rollback restores coverage');
SELECT is((SELECT count(*) FROM public.consultas WHERE paciente_id = '10000000-0000-0000-0000-000000000002' AND tipo_consulta = 'plantao'), 0::bigint, 'queue rollback creates no consulta');

SELECT * FROM finish();
ROLLBACK;
