BEGIN;

CREATE TABLE IF NOT EXISTS public.plan_credit_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  owner_type TEXT NOT NULL,
  owner_id UUID NOT NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  plan_subscription_order_id UUID REFERENCES public.plan_subscription_orders(id) ON DELETE SET NULL,
  plans_service_subscription_id TEXT,
  external_subscription_score_id TEXT,
  external_score_id TEXT,
  external_plan_id INTEGER,
  external_specialization_id INTEGER,
  specialty_code TEXT,
  status TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  request_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT plan_credit_usages_owner_type_check CHECK (
    owner_type IN ('appointment')
  ),
  CONSTRAINT plan_credit_usages_status_check CHECK (
    status IN ('pending_use', 'used', 'use_failed', 'canceled', 'released')
  )
);

CREATE INDEX IF NOT EXISTS idx_plan_credit_usages_owner
  ON public.plan_credit_usages (owner_type, owner_id);

CREATE INDEX IF NOT EXISTS idx_plan_credit_usages_appointment
  ON public.plan_credit_usages (appointment_id)
  WHERE appointment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_plan_credit_usages_external_subscription_score
  ON public.plan_credit_usages (external_subscription_score_id)
  WHERE external_subscription_score_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_credit_usages_open_external_score_unique
  ON public.plan_credit_usages (external_subscription_score_id)
  WHERE external_subscription_score_id IS NOT NULL
    AND status IN ('pending_use', 'used');

ALTER TABLE public.plan_credit_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_credit_usages FORCE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_plan_credit_usages_updated_at ON public.plan_credit_usages;
CREATE TRIGGER update_plan_credit_usages_updated_at
  BEFORE UPDATE ON public.plan_credit_usages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS funding_source TEXT NOT NULL DEFAULT 'self_pay',
  ADD COLUMN IF NOT EXISTS coverage_status TEXT,
  ADD COLUMN IF NOT EXISTS plan_credit_usage_id UUID REFERENCES public.plan_credit_usages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_subscription_order_id UUID REFERENCES public.plan_subscription_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_subscription_score_id TEXT,
  ADD COLUMN IF NOT EXISTS external_score_id TEXT,
  ADD COLUMN IF NOT EXISTS external_plan_id INTEGER,
  ADD COLUMN IF NOT EXISTS external_specialization_id INTEGER,
  ADD COLUMN IF NOT EXISTS coverage_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_funding_source_check
    CHECK (funding_source IN ('self_pay', 'plan'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_coverage_status_check
    CHECK (
      coverage_status IS NULL
      OR coverage_status IN (
        'plan_pending_use',
        'plan_used',
        'plan_use_failed',
        'plan_canceled'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_funding_source
  ON public.appointments (funding_source);

CREATE INDEX IF NOT EXISTS idx_appointments_plan_credit_usage
  ON public.appointments (plan_credit_usage_id)
  WHERE plan_credit_usage_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_plan_subscription_order
  ON public.appointments (plan_subscription_order_id)
  WHERE plan_subscription_order_id IS NOT NULL;

COMMIT;
