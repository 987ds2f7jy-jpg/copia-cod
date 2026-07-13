BEGIN;

CREATE TABLE IF NOT EXISTS public.system_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  environment TEXT NOT NULL DEFAULT 'unknown',
  actor_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  actor_role TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  outcome TEXT NOT NULL,
  error_code TEXT,
  request_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT system_audit_events_actor_role_check CHECK (
    actor_role IS NULL OR actor_role IN ('patient', 'professional', 'admin', 'system')
  ),
  CONSTRAINT system_audit_events_outcome_check CHECK (
    outcome IN ('started', 'succeeded', 'failed', 'rejected', 'resolved', 'manual_review_required')
  ),
  CONSTRAINT system_audit_events_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

COMMENT ON TABLE public.system_audit_events IS
  'Sanitized technical audit events. Define and automate retention after staging volume is measured.';

CREATE INDEX IF NOT EXISTS idx_system_audit_events_occurred_at
  ON public.system_audit_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_events_action
  ON public.system_audit_events (action, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_events_resource
  ON public.system_audit_events (resource_type, resource_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_events_outcome
  ON public.system_audit_events (outcome, occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_audit_events_request_action_unique
  ON public.system_audit_events (request_id, action, resource_type, resource_id)
  WHERE request_id IS NOT NULL AND resource_id IS NOT NULL;

ALTER TABLE public.system_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_audit_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.system_audit_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.system_audit_events TO service_role;

CREATE TABLE IF NOT EXISTS public.system_reconciliation_claims (
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  request_id TEXT NOT NULL,
  actor_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  locked_until TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (resource_type, resource_id),
  CONSTRAINT system_reconciliation_claims_resource_type_check CHECK (
    resource_type IN ('appointment', 'queue', 'solicitacao_exame', 'plan_subscription')
  )
);

ALTER TABLE public.system_reconciliation_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_reconciliation_claims FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.system_reconciliation_claims FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.system_reconciliation_claims TO service_role;

CREATE OR REPLACE FUNCTION public.sanitize_system_audit_metadata(p_metadata JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'provider', p_metadata -> 'provider',
    'retry_count', p_metadata -> 'retry_count',
    'previous_status', p_metadata -> 'previous_status',
    'next_status', p_metadata -> 'next_status',
    'issue_type', p_metadata -> 'issue_type',
    'reason_code', p_metadata -> 'reason_code',
    'external_status', p_metadata -> 'external_status',
    'payment_charge_id', p_metadata -> 'payment_charge_id',
    'plan_credit_usage_id', p_metadata -> 'plan_credit_usage_id',
    'owner_type', p_metadata -> 'owner_type'
  ));
$$;

REVOKE ALL ON FUNCTION public.sanitize_system_audit_metadata(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sanitize_system_audit_metadata(JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.sanitize_system_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.environment := left(coalesce(nullif(trim(NEW.environment), ''), 'unknown'), 40);
  NEW.action := left(trim(NEW.action), 120);
  NEW.resource_type := left(trim(NEW.resource_type), 60);
  NEW.error_code := nullif(left(trim(coalesce(NEW.error_code, '')), 120), '');
  NEW.request_id := nullif(left(trim(coalesce(NEW.request_id, '')), 120), '');
  NEW.metadata := public.sanitize_system_audit_metadata(coalesce(NEW.metadata, '{}'::jsonb));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sanitize_system_audit_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sanitize_system_audit_event_before_insert ON public.system_audit_events;
CREATE TRIGGER sanitize_system_audit_event_before_insert
  BEFORE INSERT ON public.system_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_system_audit_event();

CREATE OR REPLACE FUNCTION public.append_system_audit_event(
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_outcome TEXT,
  p_error_code TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
  v_environment TEXT := coalesce(nullif(current_setting('app.environment', true), ''), 'unknown');
BEGIN
  INSERT INTO public.system_audit_events (
    environment, actor_role, action, resource_type, resource_id, outcome, error_code, metadata
  ) VALUES (
    v_environment, 'system', p_action, p_resource_type, p_resource_id, p_outcome,
    p_error_code, coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.append_system_audit_event(TEXT, TEXT, UUID, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_system_audit_event(TEXT, TEXT, UUID, TEXT, TEXT, JSONB)
  TO service_role;

CREATE OR REPLACE FUNCTION public.audit_critical_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_status TEXT := '';
  v_new_status TEXT := lower(trim(coalesce(NEW.status, '')));
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_old_status := lower(trim(coalesce(OLD.status, '')));
  END IF;

  IF TG_TABLE_NAME = 'payment_charges' THEN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
      AND NEW.status IN ('paid', 'payment_failed', 'refunded', 'chargeback') THEN
      PERFORM public.append_system_audit_event(
        'payment.status_changed', NEW.owner_type, NEW.owner_id,
        CASE WHEN NEW.status = 'paid' THEN 'succeeded' ELSE 'failed' END,
        CASE WHEN NEW.status = 'paid' THEN NULL ELSE upper(NEW.status) END,
        jsonb_build_object(
          'provider', NEW.provider,
          'previous_status', OLD.status,
          'next_status', NEW.status,
          'payment_charge_id', NEW.id,
          'owner_type', NEW.owner_type
        )
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'plan_credit_usages' THEN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
      AND NEW.status IN ('consuming', 'used', 'use_failed', 'reconciliation_required') THEN
      PERFORM public.append_system_audit_event(
        'plan_credit.status_changed', NEW.owner_type, NEW.owner_id,
        CASE
          WHEN NEW.status = 'used' THEN 'succeeded'
          WHEN NEW.status = 'consuming' THEN 'started'
          WHEN NEW.status = 'reconciliation_required' THEN 'manual_review_required'
          ELSE 'failed'
        END,
        NEW.error_code,
        jsonb_build_object(
          'previous_status', OLD.status,
          'next_status', NEW.status,
          'plan_credit_usage_id', NEW.id,
          'owner_type', NEW.owner_type
        )
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME IN ('appointments', 'queues') THEN
    IF NEW.funding_source = 'plan'
      AND NEW.coverage_status IN ('plan_pending_use', 'plan_used')
      AND (
        TG_OP = 'INSERT'
        OR (TG_OP = 'UPDATE' AND NEW.coverage_status IS DISTINCT FROM OLD.coverage_status)
      ) THEN
      PERFORM public.append_system_audit_event(
        'plan.coverage_confirmed',
        CASE WHEN TG_TABLE_NAME = 'appointments' THEN 'appointment' ELSE 'queue' END,
        NEW.id,
        'succeeded',
        NULL,
        jsonb_build_object(
          'next_status', NEW.coverage_status,
          'plan_credit_usage_id', NEW.plan_credit_usage_id,
          'owner_type', CASE WHEN TG_TABLE_NAME = 'appointments' THEN 'appointment' ELSE 'queue' END
        )
      );
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.coverage_status IS DISTINCT FROM OLD.coverage_status
      AND NEW.coverage_status = 'plan_reconciliation_required' THEN
      PERFORM public.append_system_audit_event(
        'plan.reconciliation_required',
        CASE WHEN TG_TABLE_NAME = 'appointments' THEN 'appointment' ELSE 'queue' END,
        NEW.id, 'manual_review_required', 'PLAN_RECONCILIATION_REQUIRED',
        jsonb_build_object(
          'previous_status', OLD.coverage_status,
          'next_status', NEW.coverage_status,
          'plan_credit_usage_id', NEW.plan_credit_usage_id
        )
      );
    END IF;

    IF TG_OP = 'UPDATE' AND v_new_status IS DISTINCT FROM v_old_status THEN
      IF v_new_status IN ('accepted', 'confirmed', 'assigned', 'in_progress', 'em_atendimento') THEN
        PERFORM public.append_system_audit_event(
          'owner.accepted',
          CASE WHEN TG_TABLE_NAME = 'appointments' THEN 'appointment' ELSE 'queue' END,
          NEW.id, 'succeeded', NULL,
          jsonb_build_object('previous_status', v_old_status, 'next_status', v_new_status)
        );
      ELSIF v_new_status IN ('cancelado', 'cancelled', 'rejected', 'rejeitado') THEN
        PERFORM public.append_system_audit_event(
          'owner.cancelled',
          CASE WHEN TG_TABLE_NAME = 'appointments' THEN 'appointment' ELSE 'queue' END,
          NEW.id, 'succeeded', NULL,
          jsonb_build_object('previous_status', v_old_status, 'next_status', v_new_status)
        );
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'consultas' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.append_system_audit_event(
        'consultation.created', 'consulta', NEW.id, 'succeeded', NULL,
        jsonb_build_object('next_status', NEW.status)
      );
    ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'finalizada' THEN
      PERFORM public.append_system_audit_event(
        'consultation.finished', 'consulta', NEW.id, 'succeeded', NULL,
        jsonb_build_object('previous_status', OLD.status, 'next_status', NEW.status)
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'plan_subscription_orders' THEN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
      AND NEW.status IN ('active', 'activation_failed') THEN
      PERFORM public.append_system_audit_event(
        'plan_activation.status_changed', 'plan_subscription', NEW.id,
        CASE WHEN NEW.status = 'active' THEN 'succeeded' ELSE 'failed' END,
        NEW.error_code,
        jsonb_build_object('previous_status', OLD.status, 'next_status', NEW.status)
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_critical_transition() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_payment_charge_status ON public.payment_charges;
CREATE TRIGGER audit_payment_charge_status
  AFTER UPDATE OF status ON public.payment_charges
  FOR EACH ROW EXECUTE FUNCTION public.audit_critical_transition();

DROP TRIGGER IF EXISTS audit_plan_credit_status ON public.plan_credit_usages;
CREATE TRIGGER audit_plan_credit_status
  AFTER UPDATE OF status ON public.plan_credit_usages
  FOR EACH ROW EXECUTE FUNCTION public.audit_critical_transition();

DROP TRIGGER IF EXISTS audit_appointment_critical_transition ON public.appointments;
CREATE TRIGGER audit_appointment_critical_transition
  AFTER INSERT OR UPDATE OF status, coverage_status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.audit_critical_transition();

DROP TRIGGER IF EXISTS audit_queue_critical_transition ON public.queues;
CREATE TRIGGER audit_queue_critical_transition
  AFTER INSERT OR UPDATE OF status, coverage_status ON public.queues
  FOR EACH ROW EXECUTE FUNCTION public.audit_critical_transition();

DROP TRIGGER IF EXISTS audit_consulta_critical_transition ON public.consultas;
CREATE TRIGGER audit_consulta_critical_transition
  AFTER INSERT OR UPDATE OF status ON public.consultas
  FOR EACH ROW EXECUTE FUNCTION public.audit_critical_transition();

DROP TRIGGER IF EXISTS audit_plan_activation_transition ON public.plan_subscription_orders;
CREATE TRIGGER audit_plan_activation_transition
  AFTER UPDATE OF status ON public.plan_subscription_orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_critical_transition();

CREATE OR REPLACE FUNCTION public.acquire_financial_reconciliation_claim(
  p_resource_type TEXT,
  p_resource_id UUID,
  p_request_id TEXT,
  p_actor_user_id UUID,
  p_lock_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claimed UUID;
  v_seconds INTEGER := greatest(10, least(coalesce(p_lock_seconds, 60), 300));
BEGIN
  IF p_resource_type NOT IN ('appointment', 'queue', 'solicitacao_exame', 'plan_subscription') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RECONCILIATION_OWNER_TYPE_INVALID';
  END IF;

  INSERT INTO public.system_reconciliation_claims (
    resource_type, resource_id, request_id, actor_user_id, locked_until, updated_at
  ) VALUES (
    p_resource_type, p_resource_id, p_request_id, p_actor_user_id,
    now() + make_interval(secs => v_seconds), now()
  )
  ON CONFLICT (resource_type, resource_id) DO UPDATE
  SET request_id = EXCLUDED.request_id,
      actor_user_id = EXCLUDED.actor_user_id,
      locked_until = EXCLUDED.locked_until,
      updated_at = now()
  WHERE public.system_reconciliation_claims.locked_until <= now()
     OR public.system_reconciliation_claims.request_id = EXCLUDED.request_id
  RETURNING resource_id INTO v_claimed;

  RETURN v_claimed IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_financial_reconciliation_claim(
  p_resource_type TEXT,
  p_resource_id UUID,
  p_request_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_released UUID;
BEGIN
  UPDATE public.system_reconciliation_claims
  SET locked_until = now() + interval '5 seconds',
      updated_at = now()
  WHERE resource_type = p_resource_type
    AND resource_id = p_resource_id
    AND request_id = p_request_id
  RETURNING resource_id INTO v_released;

  RETURN v_released IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_financial_reconciliation_claim(TEXT, UUID, TEXT, UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_financial_reconciliation_claim(TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_financial_reconciliation_claim(TEXT, UUID, TEXT, UUID, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_financial_reconciliation_claim(TEXT, UUID, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.reconcile_plan_credit_usage_from_external(
  p_usage_id UUID,
  p_owner_type TEXT,
  p_owner_id UUID,
  p_request_id TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_usage public.plan_credit_usages%ROWTYPE;
  v_was_used BOOLEAN;
BEGIN
  IF p_owner_type NOT IN ('appointment', 'queue') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_OWNER_TYPE_INVALID';
  END IF;

  SELECT * INTO v_usage
  FROM public.plan_credit_usages AS usage
  WHERE usage.id = p_usage_id
    AND usage.owner_type = p_owner_type
    AND usage.owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_USAGE_NOT_FOUND';
  END IF;

  IF nullif(trim(v_usage.external_subscription_score_id), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_EXTERNAL_ID_MISSING';
  END IF;

  v_was_used := v_usage.status = 'used';

  IF NOT v_was_used AND v_usage.status NOT IN (
    'pending_use', 'consuming', 'use_failed', 'reconciliation_required'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_USAGE_NOT_RECONCILABLE';
  END IF;

  UPDATE public.plan_credit_usages
  SET status = 'used',
      used_at = coalesce(used_at, now()),
      response_snapshot = jsonb_build_object(
        'reconciled', true,
        'external_status', 'used',
        'request_id', left(coalesce(p_request_id, ''), 120)
      ),
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

  RETURN CASE WHEN v_was_used THEN 'already_used' ELSE 'reconciled' END;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_plan_credit_usage_from_external(UUID, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_plan_credit_usage_from_external(UUID, TEXT, UUID, TEXT)
  TO service_role;

CREATE OR REPLACE VIEW public.system_reconciliation_queue
WITH (security_invoker = true)
AS
WITH owners AS (
  SELECT
    'appointment'::TEXT AS owner_type,
    a.id AS owner_id,
    a.funding_source,
    a.coverage_status,
    a.payment_status,
    a.payment_required,
    a.current_payment_charge_id,
    a.plan_credit_usage_id,
    a.plan_subscription_order_id,
    a.external_subscription_score_id,
    lower(trim(coalesce(a.status, ''))) AS resource_status,
    a.updated_at
  FROM public.appointments AS a
  UNION ALL
  SELECT
    'queue', q.id, q.funding_source, q.coverage_status, q.payment_status,
    q.payment_required, q.current_payment_charge_id, q.plan_credit_usage_id,
    q.plan_subscription_order_id, q.external_subscription_score_id,
    lower(trim(coalesce(q.status, ''))), q.updated_at
  FROM public.queues AS q
  UNION ALL
  SELECT
    'solicitacao_exame', s.id, 'self_pay', NULL, s.payment_status,
    s.payment_required, s.current_payment_charge_id, NULL::UUID, NULL::UUID, NULL::TEXT,
    lower(trim(coalesce(s.status, ''))), s.updated_at
  FROM public.solicitacoes_exames AS s
  UNION ALL
  SELECT
    'plan_subscription', p.id, 'self_pay', NULL, p.payment_status,
    p.payment_required, p.current_payment_charge_id, NULL::UUID, NULL::UUID, NULL::TEXT,
    lower(trim(coalesce(p.status, ''))), p.updated_at
  FROM public.plan_subscription_orders AS p
),
active_charge_groups AS (
  SELECT owner_type, owner_id, count(*) AS active_count,
         (array_agg(id ORDER BY updated_at, id))[1] AS sample_charge_id,
         min(updated_at) AS oldest_updated_at
  FROM public.payment_charges
  WHERE status IN ('payment_pending', 'payment_processing')
  GROUP BY owner_type, owner_id
  HAVING count(*) > 1
),
duplicate_credits AS (
  SELECT external_subscription_score_id, count(*) AS usage_count
  FROM public.plan_credit_usages
  WHERE nullif(trim(external_subscription_score_id), '') IS NOT NULL
    AND status NOT IN ('canceled', 'released')
  GROUP BY external_subscription_score_id
  HAVING count(*) > 1
)
SELECT
  'payment_paid_owner_not_released'::TEXT AS issue_type,
  'high'::TEXT AS severity,
  charge.owner_type,
  charge.owner_id,
  'open'::TEXT AS status,
  owner.resource_status,
  'OWNER_PAYMENT_STATE_NOT_PAID'::TEXT AS reason_code,
  charge.updated_at AS source_updated_at,
  charge.id AS payment_charge_id,
  owner.plan_credit_usage_id,
  charge.provider
FROM public.payment_charges AS charge
JOIN owners AS owner ON owner.owner_type = charge.owner_type AND owner.owner_id = charge.owner_id
WHERE charge.status = 'paid'
  AND (owner.payment_status <> 'paid' OR owner.current_payment_charge_id IS DISTINCT FROM charge.id)

UNION ALL
SELECT
  'released_without_valid_funding', 'critical', owner.owner_type, owner.owner_id, 'open',
  owner.resource_status, 'OPERATIONAL_OWNER_WITHOUT_PAID_CHARGE', owner.updated_at,
  owner.current_payment_charge_id, owner.plan_credit_usage_id, NULL
FROM owners AS owner
WHERE owner.payment_required = true
  AND (
    (owner.owner_type = 'appointment' AND owner.resource_status IN ('accepted', 'confirmed', 'in_progress', 'em_atendimento'))
    OR (owner.owner_type = 'queue' AND owner.resource_status IN ('assigned', 'in_progress', 'em_atendimento'))
    OR (owner.owner_type = 'solicitacao_exame' AND owner.resource_status IN ('in_progress', 'completed'))
    OR (owner.owner_type = 'plan_subscription' AND owner.resource_status = 'active')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.payment_charges AS paid
    WHERE paid.owner_type = owner.owner_type AND paid.owner_id = owner.owner_id AND paid.status = 'paid'
  )

UNION ALL
SELECT
  'released_without_valid_plan_coverage', 'critical', owner.owner_type, owner.owner_id, 'open',
  owner.resource_status, 'OPERATIONAL_OWNER_WITHOUT_CONFIRMED_PLAN_USAGE', owner.updated_at,
  owner.current_payment_charge_id, owner.plan_credit_usage_id, NULL
FROM owners AS owner
LEFT JOIN public.plan_credit_usages AS usage ON usage.id = owner.plan_credit_usage_id
WHERE owner.owner_type IN ('appointment', 'queue')
  AND owner.payment_required = false
  AND (
    (owner.owner_type = 'appointment' AND owner.resource_status IN ('accepted', 'confirmed', 'in_progress', 'em_atendimento'))
    OR (owner.owner_type = 'queue' AND owner.resource_status IN ('assigned', 'in_progress', 'em_atendimento'))
  )
  AND NOT (
    owner.funding_source = 'plan'
    AND owner.coverage_status = 'plan_used'
    AND usage.status = 'used'
  )

UNION ALL
SELECT
  'multiple_active_payment_charges', 'high', group_row.owner_type, group_row.owner_id, 'open',
  owner.resource_status, 'MULTIPLE_ACTIVE_CHARGES', group_row.oldest_updated_at,
  group_row.sample_charge_id, owner.plan_credit_usage_id, NULL
FROM active_charge_groups AS group_row
LEFT JOIN owners AS owner ON owner.owner_type = group_row.owner_type AND owner.owner_id = group_row.owner_id

UNION ALL
SELECT
  'paid_charge_owner_missing', 'critical', charge.owner_type, charge.owner_id, 'open',
  'missing', 'PAID_CHARGE_OWNER_NOT_FOUND', charge.updated_at, charge.id, NULL, charge.provider
FROM public.payment_charges AS charge
LEFT JOIN owners AS owner ON owner.owner_type = charge.owner_type AND owner.owner_id = charge.owner_id
WHERE charge.status = 'paid' AND owner.owner_id IS NULL

UNION ALL
SELECT
  'webhook_processing_stalled', 'high', coalesce(charge.owner_type, 'payment_webhook'),
  charge.owner_id, 'open', 'processing', 'WEBHOOK_PROCESSING_STALLED', event.updated_at,
  event.resolved_charge_id, NULL, event.provider
FROM public.payment_webhook_events AS event
LEFT JOIN public.payment_charges AS charge ON charge.id = event.resolved_charge_id
WHERE event.received_at < now() - interval '15 minutes'
  AND (event.processed_at IS NULL OR nullif(trim(event.processing_error), '') IS NOT NULL)

UNION ALL
SELECT
  'plan_reconciliation_required', 'critical', owner.owner_type, owner.owner_id, 'open',
  owner.resource_status, 'PLAN_RECONCILIATION_REQUIRED', owner.updated_at,
  owner.current_payment_charge_id, owner.plan_credit_usage_id, NULL
FROM owners AS owner
WHERE owner.owner_type IN ('appointment', 'queue')
  AND owner.coverage_status = 'plan_reconciliation_required'

UNION ALL
SELECT
  'plan_credit_usage_stalled', 'high', usage.owner_type, usage.owner_id, 'open',
  usage.status, 'PLAN_CREDIT_USAGE_STALLED', usage.updated_at,
  owner.current_payment_charge_id, usage.id, NULL
FROM public.plan_credit_usages AS usage
LEFT JOIN owners AS owner ON owner.owner_type = usage.owner_type AND owner.owner_id = usage.owner_id
WHERE (usage.status = 'pending_use' AND usage.updated_at < now() - interval '30 minutes')
   OR (usage.status = 'consuming' AND usage.updated_at < now() - interval '10 minutes')

UNION ALL
SELECT
  'plan_used_without_used_usage', 'critical', owner.owner_type, owner.owner_id, 'open',
  owner.resource_status, 'OWNER_PLAN_USED_WITHOUT_CONFIRMED_USAGE', owner.updated_at,
  owner.current_payment_charge_id, owner.plan_credit_usage_id, NULL
FROM owners AS owner
LEFT JOIN public.plan_credit_usages AS usage ON usage.id = owner.plan_credit_usage_id
WHERE owner.owner_type IN ('appointment', 'queue')
  AND owner.coverage_status = 'plan_used'
  AND coalesce(usage.status, '') <> 'used'

UNION ALL
SELECT
  'used_plan_credit_owner_missing', 'critical', usage.owner_type, usage.owner_id, 'open',
  usage.status, 'USED_CREDIT_OWNER_NOT_FOUND', usage.updated_at, NULL, usage.id, NULL
FROM public.plan_credit_usages AS usage
LEFT JOIN owners AS owner ON owner.owner_type = usage.owner_type AND owner.owner_id = usage.owner_id
WHERE usage.status = 'used' AND owner.owner_id IS NULL

UNION ALL
SELECT
  'duplicate_external_plan_credit', 'critical', usage.owner_type, usage.owner_id, 'open',
  usage.status, 'EXTERNAL_CREDIT_LINKED_TO_MULTIPLE_OWNERS', usage.updated_at,
  owner.current_payment_charge_id, usage.id, NULL
FROM public.plan_credit_usages AS usage
JOIN duplicate_credits AS duplicate
  ON duplicate.external_subscription_score_id = usage.external_subscription_score_id
LEFT JOIN owners AS owner ON owner.owner_type = usage.owner_type AND owner.owner_id = usage.owner_id
WHERE usage.status NOT IN ('canceled', 'released')

UNION ALL
SELECT
  'plan_owner_with_active_charge', 'critical', owner.owner_type, owner.owner_id, 'open',
  owner.resource_status, 'PLAN_OWNER_HAS_ACTIVE_PAYMENT_CHARGE', charge.updated_at,
  charge.id, owner.plan_credit_usage_id, charge.provider
FROM owners AS owner
JOIN public.payment_charges AS charge
  ON charge.owner_type = owner.owner_type AND charge.owner_id = owner.owner_id
WHERE owner.owner_type IN ('appointment', 'queue')
  AND owner.funding_source = 'plan'
  AND charge.status IN ('payment_pending', 'payment_processing')

UNION ALL
SELECT
  'self_pay_owner_with_plan_credit', 'critical', owner.owner_type, owner.owner_id, 'open',
  owner.resource_status, 'SELF_PAY_OWNER_HAS_ACTIVE_PLAN_USAGE', usage.updated_at,
  owner.current_payment_charge_id, usage.id, NULL
FROM owners AS owner
JOIN public.plan_credit_usages AS usage
  ON usage.owner_type = owner.owner_type AND usage.owner_id = owner.owner_id
WHERE owner.owner_type IN ('appointment', 'queue')
  AND owner.funding_source = 'self_pay'
  AND usage.status NOT IN ('canceled', 'released')

UNION ALL
SELECT
  'plan_owner_missing_credit_identity', 'critical', owner.owner_type, owner.owner_id, 'open',
  owner.resource_status, 'PLAN_OWNER_CREDIT_IDENTITY_INCOMPLETE', owner.updated_at,
  owner.current_payment_charge_id, owner.plan_credit_usage_id, NULL
FROM owners AS owner
WHERE owner.owner_type IN ('appointment', 'queue')
  AND owner.funding_source = 'plan'
  AND (
    owner.plan_credit_usage_id IS NULL
    OR owner.plan_subscription_order_id IS NULL
    OR nullif(trim(owner.external_subscription_score_id), '') IS NULL
  )

UNION ALL
SELECT
  'owner_intermediate_state_stalled', 'high', owner.owner_type, owner.owner_id, 'open',
  owner.resource_status, 'OWNER_INTERMEDIATE_STATE_STALLED', owner.updated_at,
  owner.current_payment_charge_id, owner.plan_credit_usage_id, NULL
FROM owners AS owner
WHERE (
    owner.owner_type = 'appointment'
    AND owner.resource_status IN ('solicitado', 'requested', 'pending')
    AND owner.updated_at < now() - interval '24 hours'
  ) OR (
    owner.owner_type = 'queue'
    AND owner.resource_status IN ('waiting', 'assigned')
    AND owner.updated_at < now() - interval '2 hours'
  );

REVOKE ALL ON TABLE public.system_reconciliation_queue FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.system_reconciliation_queue TO service_role;

-- Preserve the applied plan-queue acceptance contract while removing the
-- output-column ambiguity reported by plpgsql_check.
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
  SELECT * INTO v_queue
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

  SELECT * INTO v_result
  FROM public.accept_queue_entry_transaction(
    p_queue_id,
    p_professional_app_user_id,
    p_professional_profile_id
  );

  UPDATE public.appointments AS appointment
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
  WHERE appointment.consulta_id = v_result.consulta_id::TEXT
    AND lower(trim(coalesce(appointment.appointment_type, ''))) IN ('imediato', 'instant', 'plantao');

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

COMMIT;
