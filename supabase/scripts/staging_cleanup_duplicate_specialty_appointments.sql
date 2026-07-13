-- STAGING ONLY. Never add this cleanup to a production migration.
-- Review diagnose_duplicate_specialty_appointments.sql before running this script.

BEGIN;

LOCK TABLE public.appointments IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.payment_charges IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.plan_credit_usages IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE staging_specialty_duplicate_decisions ON COMMIT DROP AS
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
facts AS (
  SELECT
    a.id,
    a.patient_id,
    a.normalized_specialty,
    a.scheduled_datetime,
    a.created_date,
    a.status,
    consulta.status AS consulta_status,
    (consulta.id IS NOT NULL) AS has_valid_consulta,
    EXISTS (
      SELECT 1
      FROM public.prontuarios AS prontuario
      WHERE prontuario.consulta_id = a.consulta_id
    ) AS has_prontuario,
    EXISTS (
      SELECT 1
      FROM public.payment_charges AS pc
      WHERE pc.owner_type = 'appointment'
        AND pc.owner_id = a.id
        AND pc.status = 'paid'
    ) AS has_paid_payment,
    EXISTS (
      SELECT 1
      FROM public.plan_credit_usages AS usage
      WHERE usage.owner_type = 'appointment'
        AND usage.owner_id = a.id
        AND usage.status = 'used'
    ) AS has_consumed_credit
  FROM active_appointments AS a
  JOIN duplicate_groups AS duplicate_group
    ON duplicate_group.patient_id = a.patient_id
   AND duplicate_group.normalized_specialty = a.normalized_specialty
   AND duplicate_group.scheduled_datetime = a.scheduled_datetime
  LEFT JOIN public.consultas AS consulta
    ON consulta.id::text = nullif(trim(a.consulta_id), '')
),
ranked AS (
  SELECT
    facts.*,
    (
      lower(trim(status)) IN ('accepted', 'confirmed', 'in_progress', 'em_atendimento')
      OR consulta_status IN ('aguardando', 'em_atendimento')
    ) AS is_accepted_or_in_attendance,
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
        created_date ASC,
        id ASC
    ) AS canonical_rank
  FROM facts
)
SELECT * FROM ranked;

-- IDs returned here require manual review. The exception below aborts the entire
-- transaction before any data is changed.
SELECT
  patient_id,
  normalized_specialty,
  scheduled_datetime,
  array_agg(id ORDER BY canonical_rank) AS technical_ids_requiring_review
FROM staging_specialty_duplicate_decisions
GROUP BY patient_id, normalized_specialty, scheduled_datetime
HAVING
  count(*) FILTER (WHERE has_valid_consulta) > 1
  OR count(*) FILTER (WHERE is_accepted_or_in_attendance) > 1
  OR count(*) FILTER (WHERE has_paid_payment) > 1
  OR count(*) FILTER (WHERE has_consumed_credit) > 1
  OR count(*) FILTER (WHERE has_prontuario) > 1
  OR bool_or(
    canonical_rank > 1
    AND (
      has_valid_consulta
      OR is_accepted_or_in_attendance
      OR has_paid_payment
      OR has_consumed_credit
      OR has_prontuario
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM staging_specialty_duplicate_decisions
    GROUP BY patient_id, normalized_specialty, scheduled_datetime
    HAVING
      count(*) FILTER (WHERE has_valid_consulta) > 1
      OR count(*) FILTER (WHERE is_accepted_or_in_attendance) > 1
      OR count(*) FILTER (WHERE has_paid_payment) > 1
      OR count(*) FILTER (WHERE has_consumed_credit) > 1
      OR count(*) FILTER (WHERE has_prontuario) > 1
      OR bool_or(
        canonical_rank > 1
        AND (
          has_valid_consulta
          OR is_accepted_or_in_attendance
          OR has_paid_payment
          OR has_consumed_credit
          OR has_prontuario
        )
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'STAGING_DUPLICATE_APPOINTMENTS_REQUIRE_MANUAL_REVIEW',
      DETAIL = 'Review the technical IDs returned by the preceding query; no changes were committed.';
  END IF;
END;
$$;

-- Pending charges are preserved but expired. Financially final charges are never
-- changed; the guard above prevents a paid discarded appointment.
UPDATE public.payment_charges AS charge
SET
  status = 'payment_expired',
  expired_at = coalesce(charge.expired_at, now()),
  failure_reason = CASE
    WHEN trim(charge.failure_reason) = ''
      THEN 'staging_duplicate_specialty_appointment_cleanup'
    ELSE charge.failure_reason
  END,
  updated_at = now()
FROM staging_specialty_duplicate_decisions AS decision
WHERE decision.canonical_rank > 1
  AND charge.owner_type = 'appointment'
  AND charge.owner_id = decision.id
  AND charge.status IN ('payment_pending', 'payment_processing');

-- No external API is called. Only local reservations that were never consumed are
-- released; confirmed external consumption always requires reconciliation.
UPDATE public.plan_credit_usages AS usage
SET
  status = 'released',
  error_code = coalesce(usage.error_code, 'STAGING_DUPLICATE_APPOINTMENT_CLEANUP'),
  error_message = coalesce(usage.error_message, 'Released local unconsumed reservation during staging cleanup.'),
  updated_at = now()
FROM staging_specialty_duplicate_decisions AS decision
WHERE decision.canonical_rank > 1
  AND usage.owner_type = 'appointment'
  AND usage.owner_id = decision.id
  AND usage.status IN ('pending_use', 'use_failed');

UPDATE public.appointments AS appointment
SET
  status = 'CANCELADO',
  cancellation_reason = CASE
    WHEN trim(coalesce(appointment.cancellation_reason, '')) = ''
      THEN 'staging_duplicate_specialty_appointment_cleanup'
    ELSE appointment.cancellation_reason
  END,
  updated_at = now()
FROM staging_specialty_duplicate_decisions AS decision
WHERE decision.canonical_rank > 1
  AND appointment.id = decision.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.appointments AS a
    WHERE a.service_code = 'specialty_request'
      AND lower(trim(a.status)) IN (
        'solicitado', 'requested', 'pending', 'accepted', 'confirmed',
        'in_progress', 'em_atendimento'
      )
    GROUP BY a.patient_id, lower(trim(a.specialty)), a.scheduled_datetime
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'STAGING_DUPLICATE_APPOINTMENTS_REMAIN';
  END IF;
END;
$$;

COMMIT;
