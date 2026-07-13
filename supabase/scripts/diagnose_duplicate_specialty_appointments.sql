-- Read-only remote diagnosis for migration 20260712190000.
-- Run in the staging SQL Editor before the cleanup script.

-- 1. Migration history and catalog state. A failed migration wrapped in BEGIN/COMMIT
-- should leave none of the new queue columns/functions/triggers/indexes behind.
SELECT version, name, statements
FROM supabase_migrations.schema_migrations
WHERE version = '20260712190000';

WITH expected_columns(object_name, column_name) AS (
  VALUES
    ('public.plan_credit_usages', 'queue_id'),
    ('public.queues', 'funding_source'),
    ('public.queues', 'coverage_status'),
    ('public.queues', 'plan_credit_usage_id'),
    ('public.queues', 'plan_subscription_order_id'),
    ('public.queues', 'external_subscription_score_id'),
    ('public.queues', 'external_score_id'),
    ('public.queues', 'external_plan_id'),
    ('public.queues', 'external_specialization_id'),
    ('public.queues', 'coverage_snapshot')
)
SELECT
  expected.object_name,
  expected.column_name,
  columns.column_name IS NOT NULL AS exists_remotely
FROM expected_columns AS expected
LEFT JOIN information_schema.columns AS columns
  ON columns.table_schema = split_part(expected.object_name, '.', 1)
 AND columns.table_name = split_part(expected.object_name, '.', 2)
 AND columns.column_name = expected.column_name
ORDER BY expected.object_name, expected.column_name;

SELECT
  'index' AS object_type,
  indexname AS object_name,
  indexdef AS definition
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_plan_credit_usages_queue',
    'idx_plan_credit_usages_open_external_score_unique',
    'idx_plan_credit_usages_active_owner_unique',
    'idx_queues_plan_credit_usage',
    'idx_queues_plan_subscription_order',
    'idx_queues_active_patient_unique',
    'idx_appointments_active_patient_specialty_schedule_unique'
  )
UNION ALL
SELECT
  'trigger',
  trigger_name,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'enforce_appointment_plan_payment_exclusivity',
    'enforce_queue_plan_payment_exclusivity',
    'enforce_payment_charge_plan_exclusivity'
  )
ORDER BY object_type, object_name;

SELECT
  constraint_name,
  table_name,
  constraint_type,
  pg_get_constraintdef(pg_constraint.oid) AS definition
FROM information_schema.table_constraints
JOIN pg_namespace
  ON pg_namespace.nspname = table_schema
JOIN pg_class
  ON pg_class.relnamespace = pg_namespace.oid
 AND pg_class.relname = table_name
JOIN pg_constraint
  ON pg_constraint.conrelid = pg_class.oid
 AND pg_constraint.conname = constraint_name
WHERE table_schema = 'public'
  AND constraint_name IN (
    'plan_credit_usages_owner_type_check',
    'plan_credit_usages_status_check',
    'queues_funding_source_check',
    'queues_coverage_status_check',
    'appointments_coverage_status_check'
  )
ORDER BY table_name, constraint_name;

SELECT
  n.nspname AS function_schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  pg_get_function_result(p.oid) AS result_type
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'enforce_plan_owner_payment_exclusivity',
    'enforce_payment_charge_plan_exclusivity',
    'finalize_plan_credit_usage',
    'create_plan_funded_appointment',
    'create_plan_funded_queue',
    'accept_plan_queue_entry_transaction',
    'cancel_queue_entry_transaction',
    'cancel_appointment_with_plan_release'
  )
ORDER BY p.proname, identity_arguments;

-- 2. Every active duplicate group and the technical records that compose it.
WITH active_appointments AS (
  SELECT
    a.*,
    lower(trim(a.specialty)) AS normalized_specialty
  FROM public.appointments AS a
  WHERE a.service_code = 'specialty_request'
    AND lower(trim(a.status)) IN (
      'solicitado', 'requested', 'pending', 'accepted', 'confirmed',
      'in_progress', 'em_atendimento'
    )
),
duplicate_groups AS (
  SELECT patient_id, normalized_specialty, scheduled_datetime
  FROM active_appointments
  GROUP BY patient_id, normalized_specialty, scheduled_datetime
  HAVING count(*) > 1
),
record_facts AS (
  SELECT
    a.id,
    a.patient_id,
    a.professional_id,
    a.specialty,
    a.normalized_specialty,
    a.service_code,
    a.status,
    a.scheduled_datetime,
    a.consulta_id,
    a.payment_required,
    a.funding_source,
    a.coverage_status,
    usage.plans_service_subscription_id AS external_subscription_id,
    usage.external_subscription_score_id AS external_credit_id,
    a.created_date AS created_at,
    a.updated_at,
    a.accepted_at,
    a.cancellation_reason,
    consulta.status AS consulta_status,
    (consulta.id IS NOT NULL) AS has_valid_consulta,
    EXISTS (
      SELECT 1
      FROM public.prontuarios AS prontuario
      WHERE prontuario.consulta_id = a.consulta_id
    ) AS has_prontuario,
    coalesce(payments.charge_ids, ARRAY[]::uuid[]) AS payment_charge_ids,
    coalesce(payments.statuses, ARRAY[]::text[]) AS payment_statuses,
    coalesce(payments.has_paid, false) AS has_paid_payment,
    coalesce(usages.usage_ids, ARRAY[]::uuid[]) AS plan_credit_usage_ids,
    coalesce(usages.statuses, ARRAY[]::text[]) AS plan_credit_usage_statuses,
    coalesce(usages.has_consumed, false) AS has_consumed_credit
  FROM active_appointments AS a
  JOIN duplicate_groups AS duplicate_group
    ON duplicate_group.patient_id = a.patient_id
   AND duplicate_group.normalized_specialty = a.normalized_specialty
   AND duplicate_group.scheduled_datetime = a.scheduled_datetime
  LEFT JOIN public.consultas AS consulta
    ON consulta.id::text = nullif(trim(a.consulta_id), '')
  LEFT JOIN public.plan_credit_usages AS usage
    ON usage.id = a.plan_credit_usage_id
  LEFT JOIN LATERAL (
    SELECT
      array_agg(pc.id ORDER BY pc.created_at) AS charge_ids,
      array_agg(pc.status ORDER BY pc.created_at) AS statuses,
      bool_or(pc.status = 'paid') AS has_paid
    FROM public.payment_charges AS pc
    WHERE pc.owner_type = 'appointment'
      AND pc.owner_id = a.id
  ) AS payments ON true
  LEFT JOIN LATERAL (
    SELECT
      array_agg(pcu.id ORDER BY pcu.created_at) AS usage_ids,
      array_agg(pcu.status ORDER BY pcu.created_at) AS statuses,
      bool_or(pcu.status = 'used') AS has_consumed
    FROM public.plan_credit_usages AS pcu
    WHERE pcu.owner_type = 'appointment'
      AND pcu.owner_id = a.id
  ) AS usages ON true
)
SELECT
  facts.*,
  row_number() OVER (
    PARTITION BY patient_id, normalized_specialty, scheduled_datetime
    ORDER BY
      has_valid_consulta DESC,
      (
        lower(trim(status)) IN ('accepted', 'confirmed', 'in_progress', 'em_atendimento')
        OR consulta_status IN ('aguardando', 'em_atendimento')
      ) DESC,
      has_paid_payment DESC,
      has_consumed_credit DESC,
      created_at ASC,
      id ASC
  ) AS canonical_rank
FROM record_facts AS facts
ORDER BY patient_id, normalized_specialty, scheduled_datetime, canonical_rank;
