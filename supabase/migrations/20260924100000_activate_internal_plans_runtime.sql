BEGIN;

CREATE OR REPLACE FUNCTION public.create_internal_plan_funded_appointment(
  p_patient_id UUID, p_patient_name TEXT, p_patient_email TEXT, p_specialty TEXT,
  p_appointment_type TEXT, p_scheduled_datetime TEXT, p_date TEXT, p_time TEXT,
  p_status TEXT, p_price NUMERIC, p_service_code TEXT, p_price_source TEXT,
  p_gross_price NUMERIC, p_fee_percent NUMERIC, p_fee_amount NUMERIC, p_net_amount NUMERIC,
  p_pricing_rule_id UUID, p_fee_rule_id UUID, p_symptoms TEXT,
  p_plan_subscription_order_id UUID, p_internal_subscription_score_id UUID,
  p_specialty_code TEXT, p_request_snapshot JSONB, p_response_snapshot JSONB, p_coverage_snapshot JSONB
)
RETURNS SETOF public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_appointment public.appointments%ROWTYPE;
  v_usage public.plan_credit_usages%ROWTYPE;
BEGIN
  PERFORM 1
  FROM public.plan_subscription_scores AS score
  JOIN public.plan_subscriptions AS subscription ON subscription.id = score.subscription_id
  WHERE score.id = p_internal_subscription_score_id
    AND score.status = 1
    AND subscription.status = 1
    AND subscription.plan_subscription_order_id = p_plan_subscription_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INTERNAL_PLAN_CREDIT_NOT_AVAILABLE';
  END IF;

  SELECT * INTO v_appointment
  FROM public.create_plan_funded_appointment(
    p_patient_id, p_patient_name, p_patient_email, p_specialty, p_appointment_type,
    p_scheduled_datetime, p_date, p_time, p_status, p_price, p_service_code, p_price_source,
    p_gross_price, p_fee_percent, p_fee_amount, p_net_amount, p_pricing_rule_id, p_fee_rule_id,
    p_symptoms, p_plan_subscription_order_id, NULL, NULL, NULL, NULL, NULL,
    p_specialty_code, p_request_snapshot, p_response_snapshot, p_coverage_snapshot
  );

  SELECT * INTO v_usage FROM public.plan_credit_usages WHERE id = v_appointment.plan_credit_usage_id FOR UPDATE;
  IF v_usage.plans_backend = 'internal' AND v_usage.internal_subscription_score_id = p_internal_subscription_score_id THEN
    RETURN NEXT v_appointment;
    RETURN;
  END IF;
  IF v_usage.plans_backend <> 'external' OR v_usage.internal_subscription_score_id IS NOT NULL
     OR v_usage.external_subscription_score_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_RESERVATION_CONFLICT';
  END IF;

  UPDATE public.plan_credit_usages
  SET plans_backend = 'internal', internal_subscription_score_id = p_internal_subscription_score_id
  WHERE id = v_usage.id;
  RETURN NEXT v_appointment;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_internal_plan_funded_queue(
  p_patient_id UUID, p_patient_name TEXT, p_patient_email TEXT, p_specialty TEXT,
  p_symptoms TEXT, p_priority_level TEXT, p_position INTEGER, p_estimated_wait_time INTEGER,
  p_service_code TEXT, p_price_source TEXT, p_gross_price NUMERIC, p_fee_percent NUMERIC,
  p_fee_amount NUMERIC, p_net_amount NUMERIC, p_pricing_rule_id UUID, p_fee_rule_id UUID,
  p_plan_subscription_order_id UUID, p_internal_subscription_score_id UUID,
  p_specialty_code TEXT, p_request_snapshot JSONB, p_response_snapshot JSONB, p_coverage_snapshot JSONB
)
RETURNS SETOF public.queues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_queue public.queues%ROWTYPE;
  v_usage public.plan_credit_usages%ROWTYPE;
BEGIN
  PERFORM 1
  FROM public.plan_subscription_scores AS score
  JOIN public.plan_subscriptions AS subscription ON subscription.id = score.subscription_id
  WHERE score.id = p_internal_subscription_score_id
    AND score.status = 1
    AND subscription.status = 1
    AND subscription.plan_subscription_order_id = p_plan_subscription_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INTERNAL_PLAN_CREDIT_NOT_AVAILABLE';
  END IF;

  SELECT * INTO v_queue
  FROM public.create_plan_funded_queue(
    p_patient_id, p_patient_name, p_patient_email, p_specialty, p_symptoms,
    p_priority_level, p_position, p_estimated_wait_time, p_service_code, p_price_source,
    p_gross_price, p_fee_percent, p_fee_amount, p_net_amount, p_pricing_rule_id, p_fee_rule_id,
    p_plan_subscription_order_id, NULL, NULL, NULL, NULL, NULL,
    p_specialty_code, p_request_snapshot, p_response_snapshot, p_coverage_snapshot
  );

  SELECT * INTO v_usage FROM public.plan_credit_usages WHERE id = v_queue.plan_credit_usage_id FOR UPDATE;
  IF v_usage.plans_backend = 'internal' AND v_usage.internal_subscription_score_id = p_internal_subscription_score_id THEN
    RETURN NEXT v_queue;
    RETURN;
  END IF;
  IF v_usage.plans_backend <> 'external' OR v_usage.internal_subscription_score_id IS NOT NULL
     OR v_usage.external_subscription_score_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_RESERVATION_CONFLICT';
  END IF;

  UPDATE public.plan_credit_usages
  SET plans_backend = 'internal', internal_subscription_score_id = p_internal_subscription_score_id
  WHERE id = v_usage.id;
  RETURN NEXT v_queue;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_internal_plan_credit_usage(
  p_usage_id UUID, p_owner_type TEXT, p_owner_id UUID, p_request_id TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_usage public.plan_credit_usages%ROWTYPE;
  v_score_status SMALLINT;
BEGIN
  IF p_owner_type NOT IN ('appointment', 'queue') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_OWNER_TYPE_INVALID';
  END IF;
  SELECT * INTO v_usage FROM public.plan_credit_usages
  WHERE id = p_usage_id AND owner_type = p_owner_type AND owner_id = p_owner_id FOR UPDATE;
  IF NOT FOUND OR v_usage.plans_backend <> 'internal' OR v_usage.internal_subscription_score_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_USAGE_LINK_INVALID';
  END IF;
  SELECT status INTO v_score_status FROM public.plan_subscription_scores
  WHERE id = v_usage.internal_subscription_score_id FOR UPDATE;
  IF v_score_status <> 2 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_NOT_USED';
  END IF;

  UPDATE public.plan_credit_usages SET
    status = 'used', used_at = coalesce(used_at, now()),
    response_snapshot = jsonb_build_object('provider', 'internal', 'reconciled', true, 'request_id', left(coalesce(p_request_id, ''), 120)),
    error_code = NULL, error_message = NULL
  WHERE id = p_usage_id;
  IF p_owner_type = 'appointment' THEN
    UPDATE public.appointments SET coverage_status = 'plan_used'
    WHERE id = p_owner_id AND funding_source = 'plan' AND payment_required = false AND plan_credit_usage_id = p_usage_id;
  ELSE
    UPDATE public.queues SET coverage_status = 'plan_used'
    WHERE id = p_owner_id AND funding_source = 'plan' AND payment_required = false AND plan_credit_usage_id = p_usage_id;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_OWNER_LINK_INVALID'; END IF;
  RETURN 'reconciled';
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_internal_plans_job(
  p_job_type TEXT, p_idempotency_key TEXT, p_payload JSONB DEFAULT '{}'::JSONB,
  p_available_at TIMESTAMPTZ DEFAULT now(), p_max_attempts INTEGER DEFAULT 5
)
RETURNS public.internal_plans_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_job public.internal_plans_jobs%ROWTYPE;
BEGIN
  INSERT INTO public.internal_plans_jobs (job_type, idempotency_key, payload, available_at, max_attempts)
  VALUES (p_job_type, trim(p_idempotency_key), coalesce(p_payload, '{}'::JSONB), coalesce(p_available_at, now()), greatest(1, p_max_attempts))
  ON CONFLICT (idempotency_key) DO UPDATE SET
    payload = CASE WHEN public.internal_plans_jobs.status <> 'succeeded' THEN EXCLUDED.payload ELSE public.internal_plans_jobs.payload END,
    status = CASE WHEN public.internal_plans_jobs.status = 'dead_letter' THEN 'pending' ELSE public.internal_plans_jobs.status END,
    attempts = CASE WHEN public.internal_plans_jobs.status = 'dead_letter' THEN 0 ELSE public.internal_plans_jobs.attempts END,
    available_at = CASE WHEN public.internal_plans_jobs.status = 'dead_letter' THEN EXCLUDED.available_at ELSE public.internal_plans_jobs.available_at END,
    completed_at = CASE WHEN public.internal_plans_jobs.status = 'dead_letter' THEN NULL ELSE public.internal_plans_jobs.completed_at END,
    error_code = CASE WHEN public.internal_plans_jobs.status = 'dead_letter' THEN NULL ELSE public.internal_plans_jobs.error_code END,
    error_message = CASE WHEN public.internal_plans_jobs.status = 'dead_letter' THEN NULL ELSE public.internal_plans_jobs.error_message END,
    updated_at = now()
  RETURNING * INTO v_job;
  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.create_internal_plan_funded_appointment(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, UUID, UUID, TEXT, UUID, UUID, TEXT, JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_internal_plan_funded_queue(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, UUID, UUID, UUID, UUID, TEXT, JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_internal_plan_credit_usage(UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_internal_plan_funded_appointment(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, UUID, UUID, TEXT, UUID, UUID, TEXT, JSONB, JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_internal_plan_funded_queue(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, UUID, UUID, UUID, UUID, TEXT, JSONB, JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_internal_plan_credit_usage(UUID, TEXT, UUID, TEXT) TO service_role;

COMMIT;
