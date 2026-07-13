BEGIN;

ALTER TABLE public.plan_credit_usages
  ADD COLUMN IF NOT EXISTS queue_id UUID REFERENCES public.queues(id) ON DELETE CASCADE;

ALTER TABLE public.plan_credit_usages
  DROP CONSTRAINT IF EXISTS plan_credit_usages_owner_type_check,
  DROP CONSTRAINT IF EXISTS plan_credit_usages_status_check;

ALTER TABLE public.plan_credit_usages
  ADD CONSTRAINT plan_credit_usages_owner_type_check
    CHECK (owner_type IN ('appointment', 'queue')),
  ADD CONSTRAINT plan_credit_usages_status_check
    CHECK (
      status IN (
        'pending_use',
        'consuming',
        'used',
        'use_failed',
        'reconciliation_required',
        'canceled',
        'released'
      )
    );

CREATE INDEX IF NOT EXISTS idx_plan_credit_usages_queue
  ON public.plan_credit_usages (queue_id)
  WHERE queue_id IS NOT NULL;

DROP INDEX IF EXISTS public.idx_plan_credit_usages_open_external_score_unique;
CREATE UNIQUE INDEX idx_plan_credit_usages_open_external_score_unique
  ON public.plan_credit_usages (external_subscription_score_id)
  WHERE external_subscription_score_id IS NOT NULL
    AND status NOT IN ('canceled', 'released');

CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_credit_usages_active_owner_unique
  ON public.plan_credit_usages (owner_type, owner_id)
  WHERE status NOT IN ('canceled', 'released');

ALTER TABLE public.queues
  ADD COLUMN IF NOT EXISTS funding_source TEXT NOT NULL DEFAULT 'self_pay',
  ADD COLUMN IF NOT EXISTS coverage_status TEXT,
  ADD COLUMN IF NOT EXISTS plan_credit_usage_id UUID REFERENCES public.plan_credit_usages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_subscription_order_id UUID REFERENCES public.plan_subscription_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_subscription_score_id TEXT,
  ADD COLUMN IF NOT EXISTS external_score_id TEXT,
  ADD COLUMN IF NOT EXISTS external_plan_id INTEGER,
  ADD COLUMN IF NOT EXISTS external_specialization_id INTEGER,
  ADD COLUMN IF NOT EXISTS coverage_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.queues
  DROP CONSTRAINT IF EXISTS queues_funding_source_check,
  DROP CONSTRAINT IF EXISTS queues_coverage_status_check;

ALTER TABLE public.queues
  ADD CONSTRAINT queues_funding_source_check
    CHECK (funding_source IN ('self_pay', 'plan')),
  ADD CONSTRAINT queues_coverage_status_check
    CHECK (
      coverage_status IS NULL
      OR coverage_status IN (
        'plan_pending_use',
        'plan_used',
        'plan_use_failed',
        'plan_reconciliation_required',
        'plan_canceled'
      )
    );

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_coverage_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_coverage_status_check
    CHECK (
      coverage_status IS NULL
      OR coverage_status IN (
        'plan_pending_use',
        'plan_used',
        'plan_use_failed',
        'plan_reconciliation_required',
        'plan_canceled'
      )
    );

CREATE INDEX IF NOT EXISTS idx_queues_plan_credit_usage
  ON public.queues (plan_credit_usage_id)
  WHERE plan_credit_usage_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_queues_plan_subscription_order
  ON public.queues (plan_subscription_order_id)
  WHERE plan_subscription_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_queues_active_patient_unique
  ON public.queues (patient_id)
  WHERE status IN ('waiting', 'assigned', 'in_progress', 'em_atendimento');

DROP INDEX IF EXISTS public.idx_appointments_active_patient_specialty_schedule_unique;
CREATE UNIQUE INDEX idx_appointments_active_patient_specialty_schedule_unique
  ON public.appointments (patient_id, lower(trim(specialty)), scheduled_datetime)
  WHERE service_code = 'specialty_request'
    AND lower(trim(status)) IN (
      'solicitado',
      'requested',
      'pending',
      'accepted',
      'confirmed',
      'in_progress',
      'em_atendimento'
    );

CREATE OR REPLACE FUNCTION public.enforce_plan_owner_payment_exclusivity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.funding_source = 'plan' OR NOT coalesce(NEW.payment_required, true) THEN
    IF NEW.current_payment_charge_id IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'PLAN_OWNER_PAYMENT_CHARGE_FORBIDDEN',
        DETAIL = 'A plan-funded owner cannot reference a one-off payment charge.';
    END IF;

    PERFORM 1
    FROM public.payment_charges AS pc
    WHERE pc.owner_type = TG_ARGV[0]
      AND pc.owner_id = NEW.id
      AND pc.status IN ('payment_pending', 'payment_processing', 'paid');

    IF FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'PLAN_OWNER_ACTIVE_PAYMENT_CHARGE_EXISTS',
        DETAIL = 'A plan-funded owner already has an active one-off payment charge.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_appointment_plan_payment_exclusivity ON public.appointments;
CREATE TRIGGER enforce_appointment_plan_payment_exclusivity
  BEFORE INSERT OR UPDATE OF funding_source, payment_required, current_payment_charge_id
  ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_plan_owner_payment_exclusivity('appointment');

DROP TRIGGER IF EXISTS enforce_queue_plan_payment_exclusivity ON public.queues;
CREATE TRIGGER enforce_queue_plan_payment_exclusivity
  BEFORE INSERT OR UPDATE OF funding_source, payment_required, current_payment_charge_id
  ON public.queues
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_plan_owner_payment_exclusivity('queue');

CREATE OR REPLACE FUNCTION public.enforce_payment_charge_plan_exclusivity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_payment_required BOOLEAN;
  v_funding_source TEXT;
BEGIN
  IF NEW.status NOT IN ('payment_pending', 'payment_processing', 'paid') THEN
    RETURN NEW;
  END IF;

  IF NEW.owner_type = 'appointment' THEN
    SELECT a.payment_required, a.funding_source
    INTO v_payment_required, v_funding_source
    FROM public.appointments AS a
    WHERE a.id = NEW.owner_id;
  ELSIF NEW.owner_type = 'queue' THEN
    SELECT q.payment_required, q.funding_source
    INTO v_payment_required, v_funding_source
    FROM public.queues AS q
    WHERE q.id = NEW.owner_id;
  ELSE
    RETURN NEW;
  END IF;

  IF FOUND AND (NOT coalesce(v_payment_required, true) OR v_funding_source = 'plan') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'PLAN_OWNER_PAYMENT_CHARGE_FORBIDDEN',
      DETAIL = 'One-off charges are forbidden for plan-funded owners.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_payment_charge_plan_exclusivity ON public.payment_charges;
CREATE TRIGGER enforce_payment_charge_plan_exclusivity
  BEFORE INSERT OR UPDATE OF owner_type, owner_id, status
  ON public.payment_charges
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_payment_charge_plan_exclusivity();

CREATE OR REPLACE FUNCTION public.finalize_plan_credit_usage(
  p_usage_id UUID,
  p_owner_type TEXT,
  p_owner_id UUID,
  p_request_snapshot JSONB,
  p_response_snapshot JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_usage public.plan_credit_usages%ROWTYPE;
BEGIN
  IF p_owner_type NOT IN ('appointment', 'queue') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_OWNER_TYPE_INVALID';
  END IF;

  SELECT *
  INTO v_usage
  FROM public.plan_credit_usages AS usage
  WHERE usage.id = p_usage_id
    AND usage.owner_type = p_owner_type
    AND usage.owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_USAGE_NOT_FOUND';
  END IF;

  IF v_usage.status = 'used' THEN
    RETURN;
  END IF;

  IF v_usage.status <> 'consuming' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_USAGE_NOT_CLAIMED';
  END IF;

  UPDATE public.plan_credit_usages
  SET status = 'used',
      used_at = now(),
      request_snapshot = coalesce(p_request_snapshot, '{}'::jsonb),
      response_snapshot = coalesce(p_response_snapshot, '{}'::jsonb),
      error_code = NULL,
      error_message = NULL
  WHERE id = p_usage_id;

  IF p_owner_type = 'appointment' THEN
    UPDATE public.appointments
    SET coverage_status = 'plan_used'
    WHERE id = p_owner_id
      AND funding_source = 'plan'
      AND payment_required = false
      AND plan_credit_usage_id = p_usage_id;
  ELSE
    UPDATE public.queues
    SET coverage_status = 'plan_used'
    WHERE id = p_owner_id
      AND funding_source = 'plan'
      AND payment_required = false
      AND plan_credit_usage_id = p_usage_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_OWNER_LINK_INVALID';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_queue_payment_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_status TEXT := lower(trim(coalesce(NEW.status, '')));
BEGIN
  IF v_status NOT IN ('assigned', 'in_progress', 'em_atendimento') THEN
    RETURN NEW;
  END IF;

  IF coalesce(NEW.payment_required, true) THEN
    IF trim(coalesce(NEW.payment_status, '')) <> 'paid' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'QUEUE_PAYMENT_REQUIRED';
    END IF;

    IF NEW.current_payment_charge_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'QUEUE_PAYMENT_CHARGE_REQUIRED';
    END IF;

    PERFORM 1
    FROM public.payment_charges AS pc
    WHERE pc.id = NEW.current_payment_charge_id
      AND pc.status = 'paid'
      AND (
        (pc.owner_type = 'queue' AND pc.owner_id = NEW.id)
        OR (
          pc.owner_type = 'solicitacao_exame'
          AND nullif(trim(coalesce(NEW.solicitacao_exame_id, '')), '') IS NOT NULL
          AND pc.owner_id::TEXT = trim(NEW.solicitacao_exame_id)
        )
      );

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'QUEUE_PAYMENT_CHARGE_NOT_PAID';
    END IF;
  ELSIF NEW.funding_source = 'plan' THEN
    IF NEW.coverage_status <> 'plan_used' OR NEW.plan_credit_usage_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'QUEUE_PLAN_CREDIT_NOT_CONFIRMED';
    END IF;

    PERFORM 1
    FROM public.plan_credit_usages AS usage
    WHERE usage.id = NEW.plan_credit_usage_id
      AND usage.owner_type = 'queue'
      AND usage.owner_id = NEW.id
      AND usage.patient_id::TEXT = NEW.patient_id
      AND usage.status = 'used';

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'QUEUE_PLAN_CREDIT_NOT_CONFIRMED';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_queue_payment_guard ON public.queues;
CREATE TRIGGER enforce_queue_payment_guard
  BEFORE INSERT OR UPDATE OF status, payment_status, current_payment_charge_id, payment_required,
    funding_source, coverage_status, plan_credit_usage_id
  ON public.queues
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_queue_payment_guard();

CREATE OR REPLACE FUNCTION public.enforce_appointment_payment_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_status TEXT := lower(trim(coalesce(NEW.status, '')));
  v_appointment_type TEXT := lower(trim(coalesce(NEW.appointment_type, '')));
BEGIN
  IF v_status NOT IN ('accepted', 'in_progress', 'em_atendimento') THEN
    RETURN NEW;
  END IF;

  IF v_appointment_type IN ('imediato', 'instant', 'plantao') AND NEW.consulta_id IS NOT NULL THEN
    PERFORM 1
    FROM public.consultas AS c
    WHERE c.id::TEXT = NEW.consulta_id
      AND lower(trim(coalesce(c.tipo_consulta, ''))) = 'plantao';

    IF FOUND THEN
      RETURN NEW;
    END IF;
  END IF;

  IF coalesce(NEW.payment_required, true) THEN
    IF trim(coalesce(NEW.payment_status, '')) <> 'paid' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APPOINTMENT_PAYMENT_REQUIRED';
    END IF;

    IF NEW.current_payment_charge_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APPOINTMENT_PAYMENT_CHARGE_REQUIRED';
    END IF;

    PERFORM 1
    FROM public.payment_charges AS pc
    WHERE pc.id = NEW.current_payment_charge_id
      AND pc.owner_type = 'appointment'
      AND pc.owner_id = NEW.id
      AND pc.status = 'paid';

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APPOINTMENT_PAYMENT_CHARGE_NOT_PAID';
    END IF;
  ELSIF NEW.funding_source = 'plan' THEN
    IF NEW.coverage_status <> 'plan_used' OR NEW.plan_credit_usage_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APPOINTMENT_PLAN_CREDIT_NOT_CONFIRMED';
    END IF;

    PERFORM 1
    FROM public.plan_credit_usages AS usage
    WHERE usage.id = NEW.plan_credit_usage_id
      AND usage.status = 'used';

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APPOINTMENT_PLAN_CREDIT_NOT_CONFIRMED';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_appointment_payment_guard ON public.appointments;
CREATE TRIGGER enforce_appointment_payment_guard
  BEFORE INSERT OR UPDATE OF status, payment_status, current_payment_charge_id, payment_required,
    funding_source, coverage_status, plan_credit_usage_id, consulta_id
  ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_appointment_payment_guard();

CREATE OR REPLACE FUNCTION public.create_plan_funded_appointment(
  p_patient_id UUID,
  p_patient_name TEXT,
  p_patient_email TEXT,
  p_specialty TEXT,
  p_appointment_type TEXT,
  p_scheduled_datetime TEXT,
  p_date TEXT,
  p_time TEXT,
  p_status TEXT,
  p_price NUMERIC,
  p_service_code TEXT,
  p_price_source TEXT,
  p_gross_price NUMERIC,
  p_fee_percent NUMERIC,
  p_fee_amount NUMERIC,
  p_net_amount NUMERIC,
  p_pricing_rule_id UUID,
  p_fee_rule_id UUID,
  p_symptoms TEXT,
  p_plan_subscription_order_id UUID,
  p_plans_service_subscription_id TEXT,
  p_external_subscription_score_id TEXT,
  p_external_score_id TEXT,
  p_external_plan_id INTEGER,
  p_external_specialization_id INTEGER,
  p_specialty_code TEXT,
  p_request_snapshot JSONB,
  p_response_snapshot JSONB,
  p_coverage_snapshot JSONB
)
RETURNS SETOF public.appointments
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_existing public.appointments%ROWTYPE;
  v_appointment_id UUID := pg_catalog.gen_random_uuid();
  v_usage_id UUID := pg_catalog.gen_random_uuid();
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(
      'plan-appointment|' || p_patient_id::TEXT || '|' || p_scheduled_datetime || '|' || lower(trim(p_specialty))
    )
  );

  SELECT *
  INTO v_existing
  FROM public.appointments AS a
  WHERE a.patient_id = p_patient_id::TEXT
    AND lower(trim(coalesce(a.specialty, ''))) = lower(trim(p_specialty))
    AND a.scheduled_datetime = p_scheduled_datetime
    AND a.service_code = p_service_code
    AND a.funding_source = 'plan'
    AND a.payment_required = false
    AND a.status IN ('SOLICITADO', 'requested', 'pending', 'accepted', 'confirmed', 'CONFIRMADO', 'in_progress', 'em_atendimento')
  ORDER BY a.created_date DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN NEXT v_existing;
    RETURN;
  END IF;

  INSERT INTO public.plan_credit_usages (
    id,
    patient_id,
    owner_type,
    owner_id,
    plan_subscription_order_id,
    plans_service_subscription_id,
    external_subscription_score_id,
    external_score_id,
    external_plan_id,
    external_specialization_id,
    specialty_code,
    status,
    request_snapshot,
    response_snapshot
  ) VALUES (
    v_usage_id,
    p_patient_id,
    'appointment',
    v_appointment_id,
    p_plan_subscription_order_id,
    nullif(trim(coalesce(p_plans_service_subscription_id, '')), ''),
    p_external_subscription_score_id,
    nullif(trim(coalesce(p_external_score_id, '')), ''),
    p_external_plan_id,
    p_external_specialization_id,
    p_specialty_code,
    'pending_use',
    coalesce(p_request_snapshot, '{}'::jsonb),
    coalesce(p_response_snapshot, '{}'::jsonb)
  );

  INSERT INTO public.appointments (
    id,
    patient_id,
    patient_name,
    patient_email,
    professional_id,
    professional_name,
    specialty,
    appointment_type,
    scheduled_datetime,
    date,
    time,
    status,
    price,
    service_code,
    price_source,
    gross_price,
    platform_fee_percent,
    platform_fee_amount,
    professional_net_amount,
    pricing_rule_id,
    fee_rule_id,
    pricing_estimated,
    payment_status,
    payment_required,
    current_payment_charge_id,
    funding_source,
    coverage_status,
    plan_credit_usage_id,
    plan_subscription_order_id,
    external_subscription_score_id,
    external_score_id,
    external_plan_id,
    external_specialization_id,
    coverage_snapshot,
    symptoms
  ) VALUES (
    v_appointment_id,
    p_patient_id::TEXT,
    coalesce(p_patient_name, ''),
    coalesce(p_patient_email, ''),
    NULL,
    '',
    p_specialty,
    p_appointment_type,
    p_scheduled_datetime,
    p_date,
    p_time,
    p_status,
    p_price,
    p_service_code,
    p_price_source,
    p_gross_price,
    p_fee_percent,
    p_fee_amount,
    p_net_amount,
    p_pricing_rule_id,
    p_fee_rule_id,
    false,
    'payment_pending',
    false,
    NULL,
    'plan',
    'plan_pending_use',
    v_usage_id,
    p_plan_subscription_order_id,
    p_external_subscription_score_id,
    nullif(trim(coalesce(p_external_score_id, '')), ''),
    p_external_plan_id,
    p_external_specialization_id,
    coalesce(p_coverage_snapshot, '{}'::jsonb),
    coalesce(p_symptoms, '')
  );

  UPDATE public.plan_credit_usages
  SET appointment_id = v_appointment_id
  WHERE id = v_usage_id;

  RETURN QUERY
  SELECT a.*
  FROM public.appointments AS a
  WHERE a.id = v_appointment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_plan_funded_queue(
  p_patient_id UUID,
  p_patient_name TEXT,
  p_patient_email TEXT,
  p_specialty TEXT,
  p_symptoms TEXT,
  p_priority_level TEXT,
  p_position INTEGER,
  p_estimated_wait_time INTEGER,
  p_service_code TEXT,
  p_price_source TEXT,
  p_gross_price NUMERIC,
  p_fee_percent NUMERIC,
  p_fee_amount NUMERIC,
  p_net_amount NUMERIC,
  p_pricing_rule_id UUID,
  p_fee_rule_id UUID,
  p_plan_subscription_order_id UUID,
  p_plans_service_subscription_id TEXT,
  p_external_subscription_score_id TEXT,
  p_external_score_id TEXT,
  p_external_plan_id INTEGER,
  p_external_specialization_id INTEGER,
  p_specialty_code TEXT,
  p_request_snapshot JSONB,
  p_response_snapshot JSONB,
  p_coverage_snapshot JSONB
)
RETURNS SETOF public.queues
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_existing public.queues%ROWTYPE;
  v_queue_id UUID := pg_catalog.gen_random_uuid();
  v_usage_id UUID := pg_catalog.gen_random_uuid();
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('plan-queue|' || p_patient_id::TEXT)
  );

  SELECT *
  INTO v_existing
  FROM public.queues AS q
  WHERE q.patient_id = p_patient_id::TEXT
    AND q.status IN ('waiting', 'assigned', 'in_progress', 'em_atendimento')
  ORDER BY q.created_date DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN NEXT v_existing;
    RETURN;
  END IF;

  INSERT INTO public.plan_credit_usages (
    id,
    patient_id,
    owner_type,
    owner_id,
    plan_subscription_order_id,
    plans_service_subscription_id,
    external_subscription_score_id,
    external_score_id,
    external_plan_id,
    external_specialization_id,
    specialty_code,
    status,
    request_snapshot,
    response_snapshot
  ) VALUES (
    v_usage_id,
    p_patient_id,
    'queue',
    v_queue_id,
    p_plan_subscription_order_id,
    nullif(trim(coalesce(p_plans_service_subscription_id, '')), ''),
    p_external_subscription_score_id,
    nullif(trim(coalesce(p_external_score_id, '')), ''),
    p_external_plan_id,
    p_external_specialization_id,
    p_specialty_code,
    'pending_use',
    coalesce(p_request_snapshot, '{}'::jsonb),
    coalesce(p_response_snapshot, '{}'::jsonb)
  );

  INSERT INTO public.queues (
    id,
    patient_id,
    patient_name,
    patient_email,
    specialty,
    symptoms,
    priority_level,
    status,
    position,
    estimated_wait_time,
    solicitacao_exame_id,
    service_code,
    price_source,
    quoted_gross_price,
    quoted_platform_fee_percent,
    quoted_platform_fee_amount,
    quoted_professional_net_amount,
    pricing_rule_id,
    fee_rule_id,
    payment_status,
    payment_required,
    current_payment_charge_id,
    funding_source,
    coverage_status,
    plan_credit_usage_id,
    plan_subscription_order_id,
    external_subscription_score_id,
    external_score_id,
    external_plan_id,
    external_specialization_id,
    coverage_snapshot
  ) VALUES (
    v_queue_id,
    p_patient_id::TEXT,
    coalesce(p_patient_name, ''),
    coalesce(p_patient_email, ''),
    p_specialty,
    coalesce(p_symptoms, ''),
    coalesce(nullif(trim(p_priority_level), ''), 'normal'),
    'waiting',
    greatest(coalesce(p_position, 1), 1),
    greatest(coalesce(p_estimated_wait_time, 10), 0),
    '',
    p_service_code,
    p_price_source,
    p_gross_price,
    p_fee_percent,
    p_fee_amount,
    p_net_amount,
    p_pricing_rule_id,
    p_fee_rule_id,
    'payment_pending',
    false,
    NULL,
    'plan',
    'plan_pending_use',
    v_usage_id,
    p_plan_subscription_order_id,
    p_external_subscription_score_id,
    nullif(trim(coalesce(p_external_score_id, '')), ''),
    p_external_plan_id,
    p_external_specialization_id,
    coalesce(p_coverage_snapshot, '{}'::jsonb)
  );

  UPDATE public.plan_credit_usages
  SET queue_id = v_queue_id
  WHERE id = v_usage_id;

  RETURN QUERY
  SELECT q.*
  FROM public.queues AS q
  WHERE q.id = v_queue_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_plan_queue_entry_transaction(
  p_queue_id UUID,
  p_professional_app_user_id TEXT,
  p_professional_profile_id UUID
)
RETURNS TABLE (
  queue_id UUID,
  queue_status TEXT,
  queue_assigned_professional_id TEXT,
  queue_patient_id TEXT,
  queue_patient_name TEXT,
  queue_specialty TEXT,
  queue_position INTEGER,
  queue_estimated_wait_time INTEGER,
  queue_solicitacao_exame_id TEXT,
  consulta_id UUID,
  consulta_status TEXT,
  consulta_tipo TEXT,
  consulta_datetime TEXT,
  consulta_professional_id TEXT,
  consulta_professional_user_id TEXT,
  consulta_professional_name TEXT
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_queue public.queues%ROWTYPE;
  v_result RECORD;
BEGIN
  SELECT *
  INTO v_queue
  FROM public.queues AS q
  WHERE q.id = p_queue_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'QUEUE_NOT_FOUND';
  END IF;

  IF v_queue.funding_source <> 'plan'
    OR coalesce(v_queue.payment_required, true)
    OR v_queue.coverage_status <> 'plan_used'
    OR v_queue.plan_credit_usage_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'QUEUE_PLAN_CREDIT_NOT_CONFIRMED';
  END IF;

  PERFORM 1
  FROM public.plan_credit_usages AS usage
  WHERE usage.id = v_queue.plan_credit_usage_id
    AND usage.owner_type = 'queue'
    AND usage.owner_id = v_queue.id
    AND usage.patient_id::TEXT = v_queue.patient_id
    AND usage.status = 'used';

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'QUEUE_PLAN_CREDIT_NOT_CONFIRMED';
  END IF;

  SELECT *
  INTO v_result
  FROM public.accept_queue_entry_transaction(
    p_queue_id,
    p_professional_app_user_id,
    p_professional_profile_id
  );

  UPDATE public.appointments
  SET payment_required = false,
      current_payment_charge_id = NULL,
      funding_source = 'plan',
      coverage_status = 'plan_used',
      plan_credit_usage_id = v_queue.plan_credit_usage_id,
      plan_subscription_order_id = v_queue.plan_subscription_order_id,
      external_subscription_score_id = v_queue.external_subscription_score_id,
      external_score_id = v_queue.external_score_id,
      external_plan_id = v_queue.external_plan_id,
      external_specialization_id = v_queue.external_specialization_id,
      coverage_snapshot = v_queue.coverage_snapshot
  WHERE consulta_id = v_result.consulta_id::TEXT
    AND lower(trim(coalesce(appointment_type, ''))) IN ('imediato', 'instant', 'plantao');

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_QUEUE_APPOINTMENT_LINK_FAILED';
  END IF;

  RETURN QUERY SELECT
    v_result.queue_id,
    v_result.queue_status,
    v_result.queue_assigned_professional_id,
    v_result.queue_patient_id,
    v_result.queue_patient_name,
    v_result.queue_specialty,
    v_result.queue_position,
    v_result.queue_estimated_wait_time,
    v_result.queue_solicitacao_exame_id,
    v_result.consulta_id,
    v_result.consulta_status,
    v_result.consulta_tipo,
    v_result.consulta_datetime,
    v_result.consulta_professional_id,
    v_result.consulta_professional_user_id,
    v_result.consulta_professional_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_queue_entry_transaction(p_queue_id UUID)
RETURNS SETOF public.queues
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_queue public.queues%ROWTYPE;
  v_usage_status TEXT;
BEGIN
  SELECT *
  INTO v_queue
  FROM public.queues AS q
  WHERE q.id = p_queue_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'QUEUE_NOT_FOUND';
  END IF;

  IF v_queue.funding_source = 'plan' AND v_queue.plan_credit_usage_id IS NOT NULL THEN
    SELECT usage.status
    INTO v_usage_status
    FROM public.plan_credit_usages AS usage
    WHERE usage.id = v_queue.plan_credit_usage_id
      AND usage.owner_type = 'queue'
      AND usage.owner_id = v_queue.id
    FOR UPDATE;

    IF v_usage_status IN ('consuming', 'used', 'reconciliation_required') THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'QUEUE_PLAN_CREDIT_CANNOT_BE_RELEASED';
    END IF;

    UPDATE public.plan_credit_usages
    SET status = 'released',
        error_code = NULL,
        error_message = NULL
    WHERE id = v_queue.plan_credit_usage_id
      AND status IN ('pending_use', 'use_failed');
  END IF;

  UPDATE public.queues
  SET status = 'cancelled',
      coverage_status = CASE
        WHEN funding_source = 'plan' THEN 'plan_canceled'
        ELSE coverage_status
      END
  WHERE id = p_queue_id;

  RETURN QUERY
  SELECT q.*
  FROM public.queues AS q
  WHERE q.id = p_queue_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_appointment_with_plan_release(
  p_appointment_id UUID,
  p_reason TEXT
)
RETURNS SETOF public.appointments
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_appointment public.appointments%ROWTYPE;
  v_usage_status TEXT;
BEGIN
  SELECT *
  INTO v_appointment
  FROM public.appointments AS a
  WHERE a.id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APPOINTMENT_NOT_FOUND';
  END IF;

  IF v_appointment.funding_source = 'plan' AND v_appointment.plan_credit_usage_id IS NOT NULL THEN
    SELECT usage.status
    INTO v_usage_status
    FROM public.plan_credit_usages AS usage
    WHERE usage.id = v_appointment.plan_credit_usage_id
      AND usage.owner_type = 'appointment'
      AND usage.owner_id = v_appointment.id
    FOR UPDATE;

    IF v_usage_status IN ('consuming', 'reconciliation_required') THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'APPOINTMENT_PLAN_CREDIT_CANNOT_BE_RELEASED';
    END IF;

    UPDATE public.plan_credit_usages
    SET status = 'released',
        error_code = NULL,
        error_message = NULL
    WHERE id = v_appointment.plan_credit_usage_id
      AND status IN ('pending_use', 'use_failed');
  END IF;

  UPDATE public.appointments
  SET status = 'CANCELADO',
      cancellation_reason = CASE
        WHEN nullif(trim(coalesce(p_reason, '')), '') IS NULL THEN cancellation_reason
        ELSE p_reason
      END,
      coverage_status = CASE
        WHEN funding_source = 'plan' AND coverage_status <> 'plan_used' THEN 'plan_canceled'
        ELSE coverage_status
      END
  WHERE id = p_appointment_id;

  RETURN QUERY
  SELECT a.*
  FROM public.appointments AS a
  WHERE a.id = p_appointment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_plan_credit_usage(UUID, TEXT, UUID, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_plan_credit_usage(UUID, TEXT, UUID, JSONB, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.accept_plan_queue_entry_transaction(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_plan_queue_entry_transaction(UUID, TEXT, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.create_plan_funded_appointment(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT,
  NUMERIC, NUMERIC, NUMERIC, NUMERIC, UUID, UUID, TEXT, UUID, TEXT, TEXT,
  TEXT, INTEGER, INTEGER, TEXT, JSONB, JSONB, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_plan_funded_appointment(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT,
  NUMERIC, NUMERIC, NUMERIC, NUMERIC, UUID, UUID, TEXT, UUID, TEXT, TEXT,
  TEXT, INTEGER, INTEGER, TEXT, JSONB, JSONB, JSONB
) TO service_role;

REVOKE ALL ON FUNCTION public.create_plan_funded_queue(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, NUMERIC,
  NUMERIC, NUMERIC, NUMERIC, UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER,
  INTEGER, TEXT, JSONB, JSONB, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_plan_funded_queue(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, NUMERIC,
  NUMERIC, NUMERIC, NUMERIC, UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER,
  INTEGER, TEXT, JSONB, JSONB, JSONB
) TO service_role;

REVOKE ALL ON FUNCTION public.cancel_queue_entry_transaction(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_queue_entry_transaction(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.cancel_appointment_with_plan_release(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_with_plan_release(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.enforce_plan_owner_payment_exclusivity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_payment_charge_plan_exclusivity() FROM PUBLIC, anon, authenticated;

COMMIT;
