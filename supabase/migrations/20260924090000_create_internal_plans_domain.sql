BEGIN;

-- Phase 1 internal Plans domain. Existing production callers remain external.
-- The financial domain continues to own payment_charges and payment webhooks.

CREATE TABLE public.plan_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  legacy_plan_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  status SMALLINT NOT NULL DEFAULT 1 CHECK (status IN (1, 2)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT plan_catalog_code_check CHECK (code IN ('psychology', 'weight_loss', 'family'))
);

CREATE TABLE public.plan_specialization_compatibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_specialization_id INTEGER NOT NULL UNIQUE,
  legacy_name TEXT NOT NULL,
  local_code TEXT NOT NULL UNIQUE,
  concil_type TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT plan_specialization_concil_type_check CHECK (
    concil_type IN ('medico', 'psicologo', 'nutricionista', 'educador_fisico')
  )
);

CREATE TABLE public.plan_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialization_id UUID NOT NULL REFERENCES public.plan_specialization_compatibility(id) ON DELETE RESTRICT,
  concil_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (specialization_id, concil_type)
);

CREATE TABLE public.plan_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plan_catalog(id) ON DELETE RESTRICT,
  plan_subscription_order_id UUID NOT NULL REFERENCES public.plan_subscription_orders(id) ON DELETE RESTRICT,
  payment_charge_id UUID NOT NULL REFERENCES public.payment_charges(id) ON DELETE RESTRICT,
  external_key TEXT NOT NULL,
  status SMALLINT NOT NULL DEFAULT 4 CHECK (status IN (1, 2, 3, 4)),
  plans_backend TEXT NOT NULL DEFAULT 'internal' CHECK (plans_backend = 'internal'),
  payment_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_subscription_order_id),
  UNIQUE (payment_charge_id)
);

CREATE INDEX idx_plan_subscriptions_lookup
  ON public.plan_subscriptions (lower(external_key), plan_id, status, created_at DESC);

CREATE TABLE public.plan_subscription_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.plan_subscriptions(id) ON DELETE CASCADE,
  score_id UUID NOT NULL REFERENCES public.plan_scores(id) ON DELETE RESTRICT,
  status SMALLINT NOT NULL DEFAULT 1 CHECK (status IN (1, 2, 3)),
  grant_period DATE NOT NULL,
  allocation_sequence SMALLINT NOT NULL DEFAULT 1 CHECK (allocation_sequence > 0),
  grant_source TEXT NOT NULL CHECK (grant_source IN ('activation', 'monthly_refresh')),
  used_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, score_id, grant_period, allocation_sequence)
);

CREATE INDEX idx_plan_subscription_scores_available
  ON public.plan_subscription_scores (subscription_id, status, created_at, id)
  WHERE status = 1;

CREATE INDEX idx_plan_subscription_scores_expiration
  ON public.plan_subscription_scores (created_at, id)
  WHERE status = 1;

CREATE TABLE public.plan_subscription_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.plan_subscriptions(id) ON DELETE CASCADE,
  external_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_plan_subscription_members_identity
  ON public.plan_subscription_members (subscription_id, lower(external_key));

CREATE INDEX idx_plan_subscription_members_lookup
  ON public.plan_subscription_members (lower(external_key), subscription_id);

CREATE TABLE public.plan_external_access_services (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  status SMALLINT NOT NULL DEFAULT 1 CHECK (status IN (1, 2)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.plan_user_external_accesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_access_service_id TEXT NOT NULL REFERENCES public.plan_external_access_services(id) ON DELETE CASCADE,
  external_key TEXT NOT NULL,
  status SMALLINT NOT NULL CHECK (status IN (1, 2)),
  last_subscription_id UUID REFERENCES public.plan_subscriptions(id) ON DELETE SET NULL,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_plan_user_external_accesses_identity
  ON public.plan_user_external_accesses (external_access_service_id, lower(external_key));

CREATE TABLE public.plan_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_charge_id UUID NOT NULL REFERENCES public.payment_charges(id) ON DELETE RESTRICT UNIQUE,
  plan_subscription_order_id UUID NOT NULL REFERENCES public.plan_subscription_orders(id) ON DELETE RESTRICT,
  plan_id UUID NOT NULL REFERENCES public.plan_catalog(id) ON DELETE RESTRICT,
  subscription_id UUID REFERENCES public.plan_subscriptions(id) ON DELETE RESTRICT UNIQUE,
  external_key TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL CHECK (currency = upper(currency) AND length(currency) = 3),
  customer JSONB NOT NULL DEFAULT '{}'::JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT plan_activations_plan_code_check CHECK (plan_code IN ('psychology', 'weight_loss', 'family'))
);

CREATE INDEX idx_plan_activations_order
  ON public.plan_activations (plan_subscription_order_id, created_at DESC);

ALTER TABLE public.plan_subscription_orders
  ADD COLUMN plans_backend TEXT NOT NULL DEFAULT 'external',
  ADD COLUMN internal_plans_subscription_id UUID REFERENCES public.plan_subscriptions(id) ON DELETE SET NULL;

ALTER TABLE public.plan_subscription_orders
  ADD CONSTRAINT plan_subscription_orders_plans_backend_check
  CHECK (plans_backend IN ('external', 'internal'));

CREATE INDEX idx_plan_subscription_orders_backend
  ON public.plan_subscription_orders (plans_backend, status, created_at DESC);

ALTER TABLE public.plan_credit_usages
  ADD COLUMN plans_backend TEXT NOT NULL DEFAULT 'external',
  ADD COLUMN internal_subscription_score_id UUID REFERENCES public.plan_subscription_scores(id) ON DELETE SET NULL;

ALTER TABLE public.plan_credit_usages
  ADD CONSTRAINT plan_credit_usages_plans_backend_check
  CHECK (plans_backend IN ('external', 'internal'));

CREATE INDEX idx_plan_credit_usages_backend
  ON public.plan_credit_usages (plans_backend, status, created_at DESC);

CREATE UNIQUE INDEX idx_plan_credit_usages_open_internal_score_unique
  ON public.plan_credit_usages (internal_subscription_score_id)
  WHERE internal_subscription_score_id IS NOT NULL
    AND status NOT IN ('canceled', 'released');

INSERT INTO public.plan_catalog (code, legacy_plan_id, name, description, status)
VALUES
  ('psychology', 1, 'Plano de psicologia', 'Plano de acompanhamento psicologico', 1),
  ('weight_loss', 2, 'Plano de emagrecimento', 'Plano para auxiliar no processo de emagrecimento', 1),
  ('family', 3, 'Plano familiar', 'Plano de auxilio a familia', 1)
ON CONFLICT (code) DO UPDATE SET
  legacy_plan_id = EXCLUDED.legacy_plan_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  updated_at = now();

INSERT INTO public.plan_specialization_compatibility (
  legacy_specialization_id, legacy_name, local_code, concil_type, aliases
)
VALUES
  (2, 'Clinica Medica', 'clinica_medica', 'medico', ARRAY['clinico_geral']),
  (22, 'Psicologia', 'psicologia', 'psicologo', ARRAY['psicologia_clinica']),
  (23, 'Nutricao', 'nutricao', 'nutricionista', ARRAY[]::TEXT[]),
  (24, 'Educacao Fisica', 'educacao_fisica', 'educador_fisico', ARRAY[]::TEXT[])
ON CONFLICT (legacy_specialization_id) DO UPDATE SET
  legacy_name = EXCLUDED.legacy_name,
  local_code = EXCLUDED.local_code,
  concil_type = EXCLUDED.concil_type,
  aliases = EXCLUDED.aliases,
  is_active = true,
  updated_at = now();

INSERT INTO public.plan_scores (specialization_id, concil_type)
SELECT compatibility.id, compatibility.concil_type
FROM public.plan_specialization_compatibility AS compatibility
ON CONFLICT (specialization_id, concil_type) DO NOTHING;

INSERT INTO public.plan_external_access_services (id, description, status)
VALUES
  ('app_nutricao', 'Servico externo do app de nutricao', 1),
  ('app_educacao_fisica', 'Servico externo do app de educacao fisica', 1)
ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.issue_internal_plan_subscription_scores(
  p_subscription_id UUID,
  p_grant_period DATE,
  p_grant_source TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan_code TEXT;
  v_score_id UUID;
  v_created INTEGER := 0;
  v_sequence INTEGER;
BEGIN
  SELECT catalog.code
  INTO v_plan_code
  FROM public.plan_subscriptions AS subscription
  JOIN public.plan_catalog AS catalog ON catalog.id = subscription.plan_id
  WHERE subscription.id = p_subscription_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_SUBSCRIPTION_NOT_FOUND';
  END IF;

  IF p_grant_source NOT IN ('activation', 'monthly_refresh') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_SCORE_GRANT_SOURCE_INVALID';
  END IF;

  IF v_plan_code = 'psychology' THEN
    SELECT score.id INTO v_score_id
    FROM public.plan_scores AS score
    JOIN public.plan_specialization_compatibility AS specialization ON specialization.id = score.specialization_id
    WHERE specialization.legacy_specialization_id = 22
      AND score.concil_type = 'psicologo'
      AND specialization.is_active
    LIMIT 1;

    IF v_score_id IS NOT NULL THEN
      FOR v_sequence IN 1..4 LOOP
        INSERT INTO public.plan_subscription_scores (
          subscription_id, score_id, status, grant_period, allocation_sequence, grant_source
        ) VALUES (
          p_subscription_id, v_score_id, 1, p_grant_period, v_sequence, p_grant_source
        ) ON CONFLICT (subscription_id, score_id, grant_period, allocation_sequence) DO NOTHING;
        v_created := v_created + CASE WHEN FOUND THEN 1 ELSE 0 END;
      END LOOP;
    END IF;
  ELSIF v_plan_code = 'weight_loss' THEN
    FOR v_score_id IN
      SELECT score.id
      FROM public.plan_scores AS score
      JOIN public.plan_specialization_compatibility AS specialization ON specialization.id = score.specialization_id
      WHERE specialization.legacy_specialization_id IN (2, 23, 24)
        AND specialization.is_active
        AND score.concil_type = specialization.concil_type
      ORDER BY specialization.legacy_specialization_id
    LOOP
      INSERT INTO public.plan_subscription_scores (
        subscription_id, score_id, status, grant_period, allocation_sequence, grant_source
      ) VALUES (
        p_subscription_id, v_score_id, 1, p_grant_period, 1, p_grant_source
      ) ON CONFLICT (subscription_id, score_id, grant_period, allocation_sequence) DO NOTHING;
      v_created := v_created + CASE WHEN FOUND THEN 1 ELSE 0 END;
    END LOOP;
  ELSIF v_plan_code = 'family' THEN
    SELECT score.id INTO v_score_id
    FROM public.plan_scores AS score
    JOIN public.plan_specialization_compatibility AS specialization ON specialization.id = score.specialization_id
    WHERE specialization.legacy_specialization_id = 2
      AND score.concil_type = 'medico'
      AND specialization.is_active
    LIMIT 1;

    IF v_score_id IS NOT NULL THEN
      INSERT INTO public.plan_subscription_scores (
        subscription_id, score_id, status, grant_period, allocation_sequence, grant_source
      ) VALUES (
        p_subscription_id, v_score_id, 1, p_grant_period, 1, p_grant_source
      ) ON CONFLICT (subscription_id, score_id, grant_period, allocation_sequence) DO NOTHING;
      v_created := v_created + CASE WHEN FOUND THEN 1 ELSE 0 END;
    END IF;
  END IF;

  RETURN v_created;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_internal_plan_external_access(p_subscription_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_subscription public.plan_subscriptions%ROWTYPE;
  v_plan_code TEXT;
  v_access_status SMALLINT;
BEGIN
  SELECT subscription, catalog.code
  INTO v_subscription, v_plan_code
  FROM public.plan_subscriptions AS subscription
  JOIN public.plan_catalog AS catalog ON catalog.id = subscription.plan_id
  WHERE subscription.id = p_subscription_id
  FOR UPDATE OF subscription;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_SUBSCRIPTION_NOT_FOUND';
  END IF;

  IF v_plan_code <> 'weight_loss' THEN
    RETURN 'not_applicable';
  END IF;

  v_access_status := CASE WHEN v_subscription.status = 1 THEN 1 ELSE 2 END;

  INSERT INTO public.plan_user_external_accesses (
    external_access_service_id, external_key, status, last_subscription_id, last_synced_at
  ) VALUES (
    'app_nutricao', v_subscription.external_key, v_access_status, v_subscription.id, now()
  )
  ON CONFLICT (external_access_service_id, (lower(external_key))) DO UPDATE SET
    status = EXCLUDED.status,
    last_subscription_id = EXCLUDED.last_subscription_id,
    last_synced_at = now(),
    updated_at = now();

  RETURN CASE WHEN v_access_status = 1 THEN 'active' ELSE 'blocked' END;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_internal_plan_subscription(
  p_plan_subscription_order_id UUID,
  p_payment_charge_id UUID,
  p_external_key TEXT,
  p_paid_at TIMESTAMPTZ,
  p_customer JSONB DEFAULT '{}'::JSONB,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.plan_subscription_orders%ROWTYPE;
  v_charge public.payment_charges%ROWTYPE;
  v_plan public.plan_catalog%ROWTYPE;
  v_activation public.plan_activations%ROWTYPE;
  v_subscription public.plan_subscriptions%ROWTYPE;
  v_created BOOLEAN := false;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('internal-plan-activation|' || p_payment_charge_id::TEXT));

  SELECT * INTO v_order
  FROM public.plan_subscription_orders
  WHERE id = p_plan_subscription_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_ORDER_NOT_FOUND';
  END IF;

  SELECT * INTO v_charge
  FROM public.payment_charges
  WHERE id = p_payment_charge_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_charge.owner_type <> 'plan_subscription'
     OR v_charge.owner_id <> p_plan_subscription_order_id
     OR v_charge.status <> 'paid' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_PAYMENT_CHARGE_NOT_PAID';
  END IF;

  SELECT * INTO v_plan
  FROM public.plan_catalog
  WHERE code = v_order.plan_code AND status = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_NOT_ACTIVE';
  END IF;

  INSERT INTO public.plan_activations (
    payment_charge_id,
    plan_subscription_order_id,
    plan_id,
    external_key,
    plan_code,
    paid_at,
    amount,
    currency,
    customer,
    metadata
  ) VALUES (
    p_payment_charge_id,
    p_plan_subscription_order_id,
    v_plan.id,
    lower(trim(p_external_key)),
    v_plan.code,
    coalesce(p_paid_at, v_charge.paid_at, now()),
    v_order.amount,
    v_order.currency,
    coalesce(p_customer, '{}'::JSONB),
    coalesce(p_metadata, '{}'::JSONB)
  ) ON CONFLICT (payment_charge_id) DO NOTHING;

  SELECT * INTO v_activation
  FROM public.plan_activations
  WHERE payment_charge_id = p_payment_charge_id
  FOR UPDATE;

  IF v_activation.plan_subscription_order_id <> p_plan_subscription_order_id
     OR v_activation.plan_id <> v_plan.id
     OR lower(v_activation.external_key) <> lower(trim(p_external_key)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_ACTIVATION_IDEMPOTENCY_CONFLICT';
  END IF;

  IF v_activation.subscription_id IS NULL THEN
    INSERT INTO public.plan_subscriptions (
      plan_id,
      plan_subscription_order_id,
      payment_charge_id,
      external_key,
      status,
      plans_backend
    ) VALUES (
      v_plan.id,
      p_plan_subscription_order_id,
      p_payment_charge_id,
      lower(trim(p_external_key)),
      4,
      'internal'
    ) RETURNING * INTO v_subscription;

    UPDATE public.plan_subscriptions
    SET status = 1,
        payment_verified_at = coalesce(p_paid_at, v_charge.paid_at, now()),
        updated_at = now()
    WHERE id = v_subscription.id
    RETURNING * INTO v_subscription;

    PERFORM public.issue_internal_plan_subscription_scores(
      v_subscription.id,
      date_trunc('month', coalesce(p_paid_at, v_charge.paid_at, now()))::DATE,
      'activation'
    );

    PERFORM public.sync_internal_plan_external_access(v_subscription.id);

    UPDATE public.plan_activations
    SET subscription_id = v_subscription.id,
        activated_at = now(),
        updated_at = now()
    WHERE id = v_activation.id
    RETURNING * INTO v_activation;

    UPDATE public.plan_subscription_orders
    SET plans_backend = 'internal',
        internal_plans_subscription_id = v_subscription.id,
        status = 'active',
        payment_status = 'paid',
        plans_service_subscription_id = NULL,
        activated_at = coalesce(activated_at, now()),
        error_code = NULL,
        error_message = NULL,
        updated_at = now()
    WHERE id = p_plan_subscription_order_id;

    v_created := true;
  ELSE
    SELECT * INTO v_subscription
    FROM public.plan_subscriptions
    WHERE id = v_activation.subscription_id;
  END IF;

  RETURN jsonb_build_object(
    'backend', 'internal',
    'created', v_created,
    'activation_id', v_activation.id::TEXT,
    'plan_code', v_plan.code,
    'legacy_plan_id', v_plan.legacy_plan_id,
    'subscription_id', v_subscription.id::TEXT,
    'external_key', v_subscription.external_key,
    'raw_status', v_subscription.status,
    'status', CASE v_subscription.status WHEN 1 THEN 'active' WHEN 2 THEN 'inactive' WHEN 3 THEN 'cancelled' ELSE 'pending' END,
    'payment_verified_at', v_subscription.payment_verified_at,
    'activated_at', v_activation.activated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.find_available_internal_subscription_score(
  p_external_key TEXT,
  p_legacy_plan_id INTEGER,
  p_legacy_specialization_id INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'backend', 'internal',
    'subscription_id', subscription.id::TEXT,
    'subscription_score_id', subscription_score.id::TEXT,
    'score_id', score.id::TEXT,
    'legacy_plan_id', catalog.legacy_plan_id,
    'plan_code', catalog.code,
    'legacy_specialization_id', specialization.legacy_specialization_id,
    'specialization_code', specialization.local_code,
    'concil_type', specialization.concil_type,
    'external_key', lower(trim(p_external_key)),
    'raw_status', subscription_score.status,
    'status', 'available',
    'created_at', subscription_score.created_at
  ) INTO v_result
  FROM public.plan_subscriptions AS subscription
  JOIN public.plan_catalog AS catalog ON catalog.id = subscription.plan_id
  JOIN public.plan_subscription_scores AS subscription_score ON subscription_score.subscription_id = subscription.id
  JOIN public.plan_scores AS score ON score.id = subscription_score.score_id
  JOIN public.plan_specialization_compatibility AS specialization ON specialization.id = score.specialization_id
  WHERE subscription.status = 1
    AND catalog.legacy_plan_id = p_legacy_plan_id
    AND subscription_score.status = 1
    AND specialization.legacy_specialization_id = p_legacy_specialization_id
    AND (
      lower(subscription.external_key) = lower(trim(p_external_key))
      OR EXISTS (
        SELECT 1
        FROM public.plan_subscription_members AS member
        WHERE member.subscription_id = subscription.id
          AND lower(member.external_key) = lower(trim(p_external_key))
      )
    )
  ORDER BY subscription.created_at DESC, subscription_score.created_at, subscription_score.id
  LIMIT 1;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.use_internal_subscription_score(p_subscription_score_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_score public.plan_subscription_scores%ROWTYPE;
  v_outcome TEXT;
BEGIN
  SELECT * INTO v_score
  FROM public.plan_subscription_scores
  WHERE id = p_subscription_score_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_SUBSCRIPTION_SCORE_NOT_FOUND';
  END IF;

  IF v_score.status = 2 THEN
    v_outcome := 'already_used';
  ELSIF v_score.status <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_SUBSCRIPTION_SCORE_NOT_AVAILABLE';
  ELSE
    UPDATE public.plan_subscription_scores
    SET status = 2, used_at = now(), updated_at = now()
    WHERE id = v_score.id
    RETURNING * INTO v_score;
    v_outcome := 'used_now';
  END IF;

  RETURN jsonb_build_object(
    'backend', 'internal',
    'outcome', v_outcome,
    'subscription_score_id', v_score.id::TEXT,
    'subscription_id', v_score.subscription_id::TEXT,
    'score_id', v_score.score_id::TEXT,
    'raw_status', v_score.status,
    'status', 'used',
    'used_at', v_score.used_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_internal_subscription_scores(
  p_external_key TEXT,
  p_subscription_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'backend', 'internal',
    'external_key', lower(trim(p_external_key)),
    'subscriptions', coalesce(jsonb_agg(subscription_payload ORDER BY created_at DESC), '[]'::JSONB)
  )
  FROM (
    SELECT
      subscription.created_at,
      jsonb_build_object(
        'id', subscription.id::TEXT,
        'plan_id', catalog.legacy_plan_id,
        'plan_code', catalog.code,
        'plan_name', catalog.name,
        'status', subscription.status,
        'status_label', CASE subscription.status WHEN 1 THEN 'active' WHEN 2 THEN 'inactive' WHEN 3 THEN 'cancelled' ELSE 'pending' END,
        'created_at', subscription.created_at,
        'scores', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'subscription_score_id', subscription_score.id::TEXT,
            'score_id', score.id::TEXT,
            'status', subscription_score.status,
            'status_label', CASE subscription_score.status WHEN 1 THEN 'available' WHEN 2 THEN 'used' ELSE 'disabled' END,
            'specialization_id', specialization.legacy_specialization_id,
            'specialization_name', specialization.legacy_name,
            'specialization_code', specialization.local_code,
            'concil_type', specialization.concil_type,
            'created_at', subscription_score.created_at,
            'used_at', subscription_score.used_at
          ) ORDER BY subscription_score.id)
          FROM public.plan_subscription_scores AS subscription_score
          JOIN public.plan_scores AS score ON score.id = subscription_score.score_id
          JOIN public.plan_specialization_compatibility AS specialization ON specialization.id = score.specialization_id
          WHERE subscription_score.subscription_id = subscription.id
        ), '[]'::JSONB)
      ) AS subscription_payload
    FROM public.plan_subscriptions AS subscription
    JOIN public.plan_catalog AS catalog ON catalog.id = subscription.plan_id
    WHERE subscription.status = 1
      AND lower(subscription.external_key) = lower(trim(p_external_key))
      AND (p_subscription_id IS NULL OR subscription.id = p_subscription_id)
  ) AS subscriptions;
$$;

CREATE OR REPLACE FUNCTION public.add_internal_family_plan_member(
  p_subscription_id UUID,
  p_holder_external_key TEXT,
  p_member_external_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_subscription public.plan_subscriptions%ROWTYPE;
  v_plan_code TEXT;
  v_member public.plan_subscription_members%ROWTYPE;
  v_people_count INTEGER;
BEGIN
  SELECT subscription, catalog.code
  INTO v_subscription, v_plan_code
  FROM public.plan_subscriptions AS subscription
  JOIN public.plan_catalog AS catalog ON catalog.id = subscription.plan_id
  WHERE subscription.id = p_subscription_id
  FOR UPDATE OF subscription;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_SUBSCRIPTION_NOT_FOUND';
  END IF;
  IF lower(v_subscription.external_key) <> lower(trim(p_holder_external_key)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_FAMILY_HOLDER_REQUIRED';
  END IF;
  IF v_subscription.status <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_FAMILY_SUBSCRIPTION_NOT_ACTIVE';
  END IF;
  IF v_plan_code <> 'family' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_FAMILY_SUBSCRIPTION_REQUIRED';
  END IF;
  IF lower(v_subscription.external_key) = lower(trim(p_member_external_key)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_FAMILY_HOLDER_ALREADY_INCLUDED';
  END IF;

  SELECT 1 + count(*) INTO v_people_count
  FROM public.plan_subscription_members
  WHERE subscription_id = p_subscription_id;

  IF v_people_count >= 4 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_FAMILY_LIMIT_REACHED';
  END IF;

  INSERT INTO public.plan_subscription_members (subscription_id, external_key)
  VALUES (p_subscription_id, lower(trim(p_member_external_key)))
  ON CONFLICT (subscription_id, (lower(external_key))) DO NOTHING
  RETURNING * INTO v_member;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_FAMILY_MEMBER_DUPLICATE';
  END IF;

  RETURN jsonb_build_object(
    'backend', 'internal',
    'member_id', v_member.id::TEXT,
    'subscription_id', v_member.subscription_id::TEXT,
    'holder_external_key', v_subscription.external_key,
    'member_external_key', v_member.external_key,
    'created_at', v_member.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_internal_plan_subscription_scores(
  p_period DATE DEFAULT date_trunc('month', now())::DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_subscription RECORD;
  v_subscriptions INTEGER := 0;
  v_scores INTEGER := 0;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('internal-plan-monthly-refresh|' || p_period::TEXT));

  FOR v_subscription IN
    SELECT subscription.id
    FROM public.plan_subscriptions AS subscription
    WHERE subscription.status = 1
      AND NOT EXISTS (
        SELECT 1 FROM public.plan_subscription_scores AS score
        WHERE score.subscription_id = subscription.id
          AND score.grant_period = p_period
      )
    ORDER BY subscription.id
    FOR UPDATE SKIP LOCKED
  LOOP
    v_subscriptions := v_subscriptions + 1;
    v_scores := v_scores + public.issue_internal_plan_subscription_scores(
      v_subscription.id, p_period, 'monthly_refresh'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'period', p_period,
    'subscriptions_processed', v_subscriptions,
    'scores_created', v_scores
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.disable_expired_internal_plan_subscription_scores(
  p_cutoff TIMESTAMPTZ DEFAULT now() - interval '1 month'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_disabled INTEGER;
BEGIN
  WITH candidates AS (
    SELECT id
    FROM public.plan_subscription_scores
    WHERE status = 1 AND created_at <= p_cutoff
    ORDER BY id
    FOR UPDATE SKIP LOCKED
  ), updated AS (
    UPDATE public.plan_subscription_scores AS score
    SET status = 3, disabled_at = now(), updated_at = now()
    FROM candidates
    WHERE score.id = candidates.id
    RETURNING score.id
  )
  SELECT count(*) INTO v_disabled FROM updated;

  RETURN jsonb_build_object('cutoff', p_cutoff, 'scores_disabled', v_disabled);
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_internal_plan_credit(
  p_subscription_score_id UUID,
  p_usage_id UUID,
  p_owner_type TEXT,
  p_owner_id UUID,
  p_request_snapshot JSONB DEFAULT '{}'::JSONB,
  p_response_snapshot JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_score public.plan_subscription_scores%ROWTYPE;
  v_usage public.plan_credit_usages%ROWTYPE;
  v_outcome TEXT;
BEGIN
  IF p_owner_type NOT IN ('appointment', 'queue') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_OWNER_TYPE_INVALID';
  END IF;

  SELECT * INTO v_score
  FROM public.plan_subscription_scores
  WHERE id = p_subscription_score_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_SUBSCRIPTION_SCORE_NOT_FOUND';
  END IF;

  SELECT * INTO v_usage
  FROM public.plan_credit_usages
  WHERE id = p_usage_id AND owner_type = p_owner_type AND owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND OR v_usage.plans_backend <> 'internal' OR v_usage.internal_subscription_score_id <> v_score.id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_USAGE_LINK_INVALID';
  END IF;

  IF v_score.status = 2 AND v_usage.status = 'used' THEN
    v_outcome := 'already_used';
  ELSE
    IF v_score.status <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_SUBSCRIPTION_SCORE_NOT_AVAILABLE';
    END IF;
    IF v_usage.status NOT IN ('pending_use', 'consuming', 'use_failed') THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PLAN_CREDIT_USAGE_NOT_PENDING';
    END IF;

    UPDATE public.plan_subscription_scores
    SET status = 2, used_at = now(), updated_at = now()
    WHERE id = v_score.id;

    UPDATE public.plan_credit_usages
    SET status = 'used',
        used_at = now(),
        request_snapshot = coalesce(p_request_snapshot, '{}'::JSONB),
        response_snapshot = coalesce(p_response_snapshot, '{}'::JSONB),
        error_code = NULL,
        error_message = NULL
    WHERE id = v_usage.id;

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

    v_outcome := 'used_now';
  END IF;

  RETURN jsonb_build_object(
    'backend', 'internal',
    'outcome', v_outcome,
    'subscription_score_id', v_score.id::TEXT,
    'usage_id', v_usage.id::TEXT,
    'owner_type', p_owner_type,
    'owner_id', p_owner_id::TEXT
  );
END;
$$;

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'plan_catalog',
    'plan_specialization_compatibility',
    'plan_scores',
    'plan_subscriptions',
    'plan_subscription_scores',
    'plan_subscription_members',
    'plan_external_access_services',
    'plan_user_external_accesses',
    'plan_activations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', v_table);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', v_table);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_internal_plan_subscription_scores(UUID, DATE, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_internal_plan_external_access(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_internal_plan_subscription(UUID, UUID, TEXT, TIMESTAMPTZ, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.find_available_internal_subscription_score(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.use_internal_subscription_score(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_internal_subscription_scores(TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_internal_family_plan_member(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_internal_plan_subscription_scores(DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.disable_expired_internal_plan_subscription_scores(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_internal_plan_credit(UUID, UUID, TEXT, UUID, JSONB, JSONB) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.activate_internal_plan_subscription(UUID, UUID, TEXT, TIMESTAMPTZ, JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.find_available_internal_subscription_score(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.use_internal_subscription_score(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_internal_subscription_scores(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_internal_family_plan_member(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_internal_plan_subscription_scores(DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.disable_expired_internal_plan_subscription_scores(TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_internal_plan_credit(UUID, UUID, TEXT, UUID, JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_internal_plan_external_access(UUID) TO service_role;

COMMIT;
