BEGIN;

-- A consultation that never acquired inicio_at is operationally different from
-- a completed or cancelled consultation. Keep the reason and transition time
-- separate from clinical timestamps.
ALTER TABLE public.consultas
  ADD COLUMN IF NOT EXISTS lifecycle_reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS deadline_elapsed_at TIMESTAMPTZ;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS expiration_reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;

ALTER TABLE public.consultas
  DROP CONSTRAINT IF EXISTS consultas_status_check;

ALTER TABLE public.consultas
  ADD CONSTRAINT consultas_status_check
  CHECK (status IN ('aguardando', 'em_atendimento', 'finalizada', 'cancelada', 'nao_realizada'));

CREATE INDEX IF NOT EXISTS idx_consultas_scheduled_deadline_candidates
  ON public.consultas (datetime, created_date)
  WHERE status = 'aguardando'
    AND coalesce(nullif(trim(inicio_at), ''), '') = ''
    AND coalesce(nullif(trim(tipo_consulta), ''), '') <> 'plantao';

CREATE INDEX IF NOT EXISTS idx_appointments_consulta_id
  ON public.appointments (consulta_id)
  WHERE coalesce(nullif(trim(consulta_id), ''), '') <> '';

CREATE OR REPLACE FUNCTION public.resolve_scheduled_consultation_start_at(p_datetime TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_value TEXT := trim(coalesce(p_datetime, ''));
BEGIN
  IF v_value = '' THEN
    RETURN NULL;
  END IF;

  IF v_value ~* '(z|[+-][0-9]{2}:?[0-9]{2})$' THEN
    BEGIN
      RETURN v_value::TIMESTAMPTZ;
    EXCEPTION WHEN others THEN
      RETURN NULL;
    END;
  END IF;

  IF v_value !~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$' THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN replace(v_value, 'T', ' ')::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo';
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_scheduled_consulta_session(
  p_consultation_id UUID,
  p_room_id TEXT,
  p_room_token TEXT
)
RETURNS SETOF public.consultas
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_consulta public.consultas%ROWTYPE;
  v_appointment public.appointments%ROWTYPE;
  v_scheduled_at TIMESTAMPTZ;
  v_deadline_at TIMESTAMPTZ;
  v_started_at TIMESTAMPTZ := clock_timestamp();
  v_appointment_count INTEGER := 0;
BEGIN
  -- Lock order is always consultation, then its linked appointment.
  SELECT * INTO v_consulta
  FROM public.consultas
  WHERE id = p_consultation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONSULTATION_NOT_FOUND';
  END IF;

  IF v_consulta.status IN ('finalizada', 'cancelada', 'nao_realizada') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONSULTATION_ALREADY_CLOSED';
  END IF;

  IF coalesce(nullif(trim(v_consulta.inicio_at), ''), '') = ''
    AND lower(trim(coalesce(v_consulta.tipo_consulta, ''))) <> 'plantao'
  THEN
    v_scheduled_at := public.resolve_scheduled_consultation_start_at(v_consulta.datetime);

    IF v_scheduled_at IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONSULTATION_SCHEDULE_INVALID';
    END IF;

    v_deadline_at := v_scheduled_at + interval '30 minutes';

    IF v_started_at < v_scheduled_at THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONSULTATION_START_TOO_EARLY';
    END IF;

    IF v_started_at > v_deadline_at THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONSULTATION_START_DEADLINE_ELAPSED';
    END IF;
  END IF;

  FOR v_appointment IN
    SELECT *
    FROM public.appointments
    WHERE consulta_id = v_consulta.id::TEXT
    ORDER BY id
    FOR UPDATE
  LOOP
    v_appointment_count := v_appointment_count + 1;
  END LOOP;

  IF v_appointment_count > 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONSULTATION_APPOINTMENT_LINK_AMBIGUOUS';
  END IF;

  UPDATE public.consultas
  SET status = 'em_atendimento',
      inicio_at = coalesce(nullif(trim(inicio_at), ''), v_started_at::TEXT),
      sala_id = p_room_id,
      token_sala = p_room_token
  WHERE id = v_consulta.id
    AND status IN ('aguardando', 'em_atendimento');

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONSULTATION_START_STATE_CONFLICT';
  END IF;

  IF v_appointment_count = 1
    AND coalesce(nullif(trim(v_appointment.status), ''), '') NOT IN (
      'completed', 'cancelled', 'CANCELADO', 'CONCLUIDO', 'EXPIRADO'
    )
  THEN
    UPDATE public.appointments
    SET status = 'in_progress'
    WHERE id = v_appointment.id;
  END IF;

  RETURN QUERY
  SELECT c.*
  FROM public.consultas AS c
  WHERE c.id = v_consulta.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.scheduled_consultation_expiration_dry_run(
  p_limit INTEGER DEFAULT 100,
  p_rollout_cutoff TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  consultation_id UUID,
  classification TEXT,
  linked_appointment_count INTEGER,
  deadline_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH candidate AS (
    SELECT
      c.id,
      c.status,
      c.tipo_consulta,
      c.datetime,
      c.inicio_at,
      c.created_date,
      public.resolve_scheduled_consultation_start_at(c.datetime) AS scheduled_at,
      (
        SELECT count(*)::INTEGER
        FROM public.appointments AS a
        WHERE a.consulta_id = c.id::TEXT
      ) AS appointment_count,
      EXISTS (
        SELECT 1 FROM public.prontuarios AS p WHERE p.consulta_id = c.id::TEXT
      ) AS has_clinical_record,
      EXISTS (
        SELECT 1
        FROM public.appointments AS a
        WHERE a.consulta_id = c.id::TEXT
          AND lower(trim(coalesce(a.status, ''))) IN ('completed', 'cancelled', 'expirado')
      ) AS has_terminal_appointment,
      EXISTS (
        SELECT 1
        FROM public.appointments AS a
        WHERE a.consulta_id = c.id::TEXT
          AND (
            lower(trim(coalesce(a.payment_status, ''))) = 'paid'
            OR lower(trim(coalesce(a.funding_source, ''))) = 'plan'
            OR a.plan_credit_usage_id IS NOT NULL
          )
      ) AS financial_policy_blocker
    FROM public.consultas AS c
    WHERE c.status = 'aguardando'
      AND lower(trim(coalesce(c.tipo_consulta, ''))) <> 'plantao'
      AND (p_rollout_cutoff IS NULL OR c.created_date >= p_rollout_cutoff)
    ORDER BY c.created_date ASC
    LIMIT greatest(1, least(coalesce(p_limit, 100), 500))
  )
  SELECT
    id,
    CASE
      WHEN coalesce(nullif(trim(inicio_at), ''), '') <> '' THEN 'start_evidence'
      WHEN scheduled_at IS NULL THEN 'invalid_schedule'
      WHEN appointment_count <> 1 THEN 'inconsistent_link'
      WHEN has_clinical_record THEN 'clinical_evidence_requires_review'
      WHEN has_terminal_appointment THEN 'conflicting_terminal_link'
      WHEN financial_policy_blocker THEN 'financial_policy_blocker'
      WHEN scheduled_at + interval '30 minutes' > now() THEN 'not_due'
      ELSE 'eligible'
    END,
    appointment_count,
    CASE WHEN scheduled_at IS NULL THEN NULL ELSE scheduled_at + interval '30 minutes' END
  FROM candidate;
$$;

CREATE OR REPLACE FUNCTION public.expire_overdue_scheduled_consultations(
  p_limit INTEGER DEFAULT 100,
  p_rollout_cutoff TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (processed INTEGER, skipped INTEGER, inconsistent INTEGER, failed INTEGER)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_candidate RECORD;
  v_appointment public.appointments%ROWTYPE;
  v_appointment_count INTEGER;
  v_processed INTEGER := 0;
  v_skipped INTEGER := 0;
  v_inconsistent INTEGER := 0;
  v_failed INTEGER := 0;
BEGIN
  FOR v_candidate IN
    SELECT
      c.id,
      c.datetime,
      public.resolve_scheduled_consultation_start_at(c.datetime) AS scheduled_at
    FROM public.consultas AS c
    WHERE c.status = 'aguardando'
      AND coalesce(nullif(trim(c.inicio_at), ''), '') = ''
      AND lower(trim(coalesce(c.tipo_consulta, ''))) <> 'plantao'
      AND (p_rollout_cutoff IS NULL OR c.created_date >= p_rollout_cutoff)
    ORDER BY c.created_date ASC
    LIMIT greatest(1, least(coalesce(p_limit, 100), 500))
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      IF v_candidate.scheduled_at IS NULL THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      IF v_candidate.scheduled_at + interval '30 minutes' >= now() THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      SELECT count(*)::INTEGER INTO v_appointment_count
      FROM public.appointments AS a
      WHERE a.consulta_id = v_candidate.id::TEXT;

      IF v_appointment_count <> 1
        OR EXISTS (SELECT 1 FROM public.prontuarios AS p WHERE p.consulta_id = v_candidate.id::TEXT)
      THEN
        v_inconsistent := v_inconsistent + 1;
        CONTINUE;
      END IF;

      SELECT * INTO v_appointment
      FROM public.appointments AS a
      WHERE a.consulta_id = v_candidate.id::TEXT
      FOR UPDATE;

      IF lower(trim(coalesce(v_appointment.status, ''))) NOT IN ('accepted', 'confirmed') THEN
        v_inconsistent := v_inconsistent + 1;
        CONTINUE;
      END IF;

      UPDATE public.consultas
      SET status = 'nao_realizada',
          lifecycle_reason = 'scheduled_start_deadline_elapsed',
          deadline_elapsed_at = now()
      WHERE id = v_candidate.id
        AND status = 'aguardando'
        AND coalesce(nullif(trim(inicio_at), ''), '') = '';

      IF NOT FOUND THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      UPDATE public.appointments
      SET status = 'EXPIRADO',
          expiration_reason = 'scheduled_start_deadline_elapsed',
          expired_at = now()
      WHERE id = v_appointment.id
        AND lower(trim(coalesce(status, ''))) IN ('accepted', 'confirmed');

      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APPOINTMENT_EXPIRATION_STATE_CONFLICT';
      END IF;

      v_processed := v_processed + 1;
    EXCEPTION WHEN others THEN
      v_failed := v_failed + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_skipped, v_inconsistent, v_failed;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_scheduled_consultation_not_performed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
    AND NEW.status = 'nao_realizada'
  THEN
    PERFORM public.append_system_audit_event(
      'consultation.not_performed',
      'consulta',
      NEW.id,
      'succeeded',
      NULL,
      jsonb_build_object(
        'previous_status', OLD.status,
        'next_status', NEW.status,
        'reason_code', NEW.lifecycle_reason
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_scheduled_consultation_not_performed ON public.consultas;
CREATE TRIGGER audit_scheduled_consultation_not_performed
AFTER UPDATE OF status ON public.consultas
FOR EACH ROW EXECUTE FUNCTION public.audit_scheduled_consultation_not_performed();

REVOKE ALL ON FUNCTION public.start_scheduled_consulta_session(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.scheduled_consultation_expiration_dry_run(INTEGER, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_overdue_scheduled_consultations(INTEGER, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_scheduled_consulta_session(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.scheduled_consultation_expiration_dry_run(INTEGER, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_overdue_scheduled_consultations(INTEGER, TIMESTAMPTZ) TO service_role;

COMMIT;
