BEGIN;

-- The owner lock serializes competing professionals before either can touch a credit.
-- Nested RPC calls run in this same PostgreSQL transaction; an exception rolls all
-- score, usage, owner, and consultation writes back together.
CREATE OR REPLACE FUNCTION public.accept_internal_plan_appointment_transaction(
  p_appointment_id UUID,
  p_professional_app_user_id TEXT,
  p_professional_profile_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_owner public.appointments%ROWTYPE;
  v_usage public.plan_credit_usages%ROWTYPE;
  v_score public.plan_subscription_scores%ROWTYPE;
  v_result RECORD;
  v_consumption JSONB;
BEGIN
  SELECT * INTO v_owner FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APPOINTMENT_NOT_FOUND';
  END IF;
  IF v_owner.funding_source <> 'plan' OR coalesce(v_owner.payment_required, true)
    OR v_owner.plan_credit_usage_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_OWNER_LINK_INVALID';
  END IF;

  -- Replay is valid only for the professional who owns the accepted attendance.
  IF v_owner.status IN ('accepted', 'confirmed', 'CONFIRMADO', 'in_progress', 'em_atendimento') THEN
    IF v_owner.professional_id IS DISTINCT FROM p_professional_profile_id::TEXT THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROFESSIONAL_PROFILE_MISMATCH';
    END IF;
    PERFORM 1 FROM public.plan_credit_usages AS u
      JOIN public.plan_subscription_scores AS s ON s.id = u.internal_subscription_score_id
      WHERE u.id = v_owner.plan_credit_usage_id AND u.owner_type = 'appointment'
        AND u.owner_id = v_owner.id AND u.patient_id::TEXT = v_owner.patient_id
        AND u.plans_backend = 'internal' AND u.status = 'used' AND s.status = 2;
    IF NOT FOUND OR v_owner.coverage_status <> 'plan_used' OR v_owner.consulta_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APPOINTMENT_ACCEPTANCE_INCOMPLETE';
    END IF;
    SELECT v_owner.id AS appointment_id, v_owner.status AS appointment_status,
      v_owner.accepted_at AS appointment_accepted_at,
      v_owner.scheduled_datetime AS appointment_scheduled_datetime,
      v_owner.professional_id AS appointment_professional_id,
      v_owner.professional_name AS appointment_professional_name,
      c.id AS consulta_id, c.status AS consulta_status,
      c.tipo_consulta AS consulta_tipo, c.datetime AS consulta_datetime
      INTO v_result FROM public.consultas AS c
      WHERE c.id::TEXT = v_owner.consulta_id
        AND c.paciente_id = v_owner.patient_id
        AND c.profissional_id = p_professional_profile_id::TEXT
        AND c.profissional_user_id = p_professional_app_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APPOINTMENT_ACCEPTANCE_INCOMPLETE';
    END IF;
    RETURN jsonb_build_object('accepted_now', false, 'result', to_jsonb(v_result));
  END IF;

  IF v_owner.status NOT IN ('requested', 'pending', 'SOLICITADO') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APPOINTMENT_NOT_REQUESTED';
  END IF;
  SELECT * INTO v_usage FROM public.plan_credit_usages
    WHERE id = v_owner.plan_credit_usage_id AND owner_type = 'appointment'
      AND owner_id = v_owner.id AND patient_id::TEXT = v_owner.patient_id;
  IF NOT FOUND OR v_usage.plans_backend <> 'internal' OR v_usage.internal_subscription_score_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_USAGE_LINK_INVALID';
  END IF;
  -- Keep the existing consumption lock order: score, then usage.
  SELECT * INTO v_score FROM public.plan_subscription_scores
    WHERE id = v_usage.internal_subscription_score_id FOR UPDATE;
  IF NOT FOUND OR v_score.status <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_SUBSCRIPTION_SCORE_NOT_AVAILABLE';
  END IF;
  PERFORM 1 FROM public.plan_credit_usages WHERE id = v_usage.id FOR UPDATE;
  PERFORM 1 FROM public.plan_subscriptions AS s WHERE s.id = v_score.subscription_id AND s.status = 1 FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_SUBSCRIPTION_NOT_ACTIVE';
  END IF;
  v_consumption := public.consume_internal_plan_credit(v_score.id, v_usage.id, 'appointment', v_owner.id,
    jsonb_build_object('provider', 'internal', 'subscription_score_id', v_score.id::TEXT),
    '{"provider":"internal","confirmed":true}'::JSONB);
  IF v_consumption->>'outcome' <> 'used_now' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_USAGE_NOT_PENDING';
  END IF;
  SELECT * INTO v_result FROM public.accept_appointment_transaction(
    p_appointment_id, p_professional_app_user_id, p_professional_profile_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'APPOINTMENT_ACCEPTANCE_INCOMPLETE';
  END IF;
  RETURN jsonb_build_object('accepted_now', true, 'result', to_jsonb(v_result));
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_internal_plan_queue_entry_transaction(
  p_queue_id UUID,
  p_professional_app_user_id TEXT,
  p_professional_profile_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_owner public.queues%ROWTYPE;
  v_usage public.plan_credit_usages%ROWTYPE;
  v_score public.plan_subscription_scores%ROWTYPE;
  v_result RECORD;
  v_consumption JSONB;
BEGIN
  SELECT * INTO v_owner FROM public.queues WHERE id = p_queue_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'QUEUE_NOT_FOUND';
  END IF;
  IF v_owner.funding_source <> 'plan' OR coalesce(v_owner.payment_required, true)
    OR v_owner.plan_credit_usage_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_OWNER_LINK_INVALID';
  END IF;

  IF v_owner.status IN ('assigned', 'in_progress', 'em_atendimento') THEN
    IF v_owner.assigned_professional_id IS DISTINCT FROM p_professional_profile_id::TEXT THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'QUEUE_ALREADY_ASSIGNED';
    END IF;
    PERFORM 1 FROM public.plan_credit_usages AS u
      JOIN public.plan_subscription_scores AS s ON s.id = u.internal_subscription_score_id
      WHERE u.id = v_owner.plan_credit_usage_id AND u.owner_type = 'queue'
        AND u.owner_id = v_owner.id AND u.patient_id::TEXT = v_owner.patient_id
        AND u.plans_backend = 'internal' AND u.status = 'used' AND s.status = 2;
    IF NOT FOUND OR v_owner.coverage_status <> 'plan_used' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'QUEUE_PLAN_CREDIT_NOT_CONFIRMED';
    END IF;
    SELECT v_owner.id AS queue_id, v_owner.status AS queue_status,
      v_owner.assigned_professional_id AS queue_assigned_professional_id,
      v_owner.patient_id AS queue_patient_id, v_owner.patient_name AS queue_patient_name,
      v_owner.specialty AS queue_specialty, v_owner.position AS queue_position,
      v_owner.estimated_wait_time AS queue_estimated_wait_time,
      coalesce(v_owner.solicitacao_exame_id, '') AS queue_solicitacao_exame_id,
      c.id AS consulta_id, c.status AS consulta_status, c.tipo_consulta AS consulta_tipo,
      c.datetime AS consulta_datetime, c.profissional_id AS consulta_professional_id,
      c.profissional_user_id AS consulta_professional_user_id,
      c.profissional_nome AS consulta_professional_name
      INTO v_result FROM public.appointments AS a
      JOIN public.consultas AS c ON c.id::TEXT = a.consulta_id
      WHERE a.plan_credit_usage_id = v_owner.plan_credit_usage_id
        AND a.patient_id = v_owner.patient_id
        AND a.status IN ('accepted', 'confirmed', 'CONFIRMADO', 'in_progress', 'em_atendimento')
        AND a.coverage_status = 'plan_used'
        AND c.paciente_id = v_owner.patient_id
        AND c.tipo_consulta = 'plantao'
        AND c.profissional_id = p_professional_profile_id::TEXT
        AND c.profissional_user_id = p_professional_app_user_id
      LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_QUEUE_APPOINTMENT_LINK_FAILED';
    END IF;
    RETURN jsonb_build_object('accepted_now', false, 'result', to_jsonb(v_result));
  END IF;

  IF v_owner.status <> 'waiting' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'QUEUE_NOT_WAITING';
  END IF;
  SELECT * INTO v_usage FROM public.plan_credit_usages
    WHERE id = v_owner.plan_credit_usage_id AND owner_type = 'queue'
      AND owner_id = v_owner.id AND patient_id::TEXT = v_owner.patient_id;
  IF NOT FOUND OR v_usage.plans_backend <> 'internal' OR v_usage.internal_subscription_score_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_USAGE_LINK_INVALID';
  END IF;
  SELECT * INTO v_score FROM public.plan_subscription_scores
    WHERE id = v_usage.internal_subscription_score_id FOR UPDATE;
  IF NOT FOUND OR v_score.status <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_SUBSCRIPTION_SCORE_NOT_AVAILABLE';
  END IF;
  PERFORM 1 FROM public.plan_credit_usages WHERE id = v_usage.id FOR UPDATE;
  PERFORM 1 FROM public.plan_subscriptions AS s WHERE s.id = v_score.subscription_id AND s.status = 1 FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_SUBSCRIPTION_NOT_ACTIVE';
  END IF;
  v_consumption := public.consume_internal_plan_credit(v_score.id, v_usage.id, 'queue', v_owner.id,
    jsonb_build_object('provider', 'internal', 'subscription_score_id', v_score.id::TEXT),
    '{"provider":"internal","confirmed":true}'::JSONB);
  IF v_consumption->>'outcome' <> 'used_now' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_USAGE_NOT_PENDING';
  END IF;
  SELECT * INTO v_result FROM public.accept_plan_queue_entry_transaction(
    p_queue_id, p_professional_app_user_id, p_professional_profile_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_QUEUE_APPOINTMENT_LINK_FAILED';
  END IF;
  RETURN jsonb_build_object('accepted_now', true, 'result', to_jsonb(v_result));
END;
$$;

REVOKE ALL ON FUNCTION public.accept_internal_plan_appointment_transaction(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_internal_plan_queue_entry_transaction(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_internal_plan_appointment_transaction(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_internal_plan_queue_entry_transaction(UUID, TEXT, UUID) TO service_role;

COMMIT;
