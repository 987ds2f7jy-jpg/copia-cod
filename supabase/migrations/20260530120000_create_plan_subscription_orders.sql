BEGIN;

CREATE TABLE IF NOT EXISTS public.plan_subscription_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  app_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  plan_code TEXT NOT NULL,
  external_plan_id INTEGER,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pending_payment',
  payment_status TEXT,
  payment_required BOOLEAN NOT NULL DEFAULT true,
  current_payment_charge_id UUID REFERENCES public.payment_charges(id) ON DELETE SET NULL,
  plans_service_subscription_id TEXT,
  external_key TEXT,
  request_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code TEXT,
  error_message TEXT,
  paid_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT plan_subscription_orders_plan_code_check CHECK (
    plan_code IN ('weight_loss', 'psychology', 'family')
  ),
  CONSTRAINT plan_subscription_orders_status_check CHECK (
    status IN (
      'pending_payment',
      'payment_confirmed',
      'activating_plan',
      'active',
      'activation_failed',
      'canceled',
      'refunded'
    )
  ),
  CONSTRAINT plan_subscription_orders_payment_status_check CHECK (
    payment_status IS NULL OR payment_status IN (
      'payment_pending',
      'payment_processing',
      'paid',
      'payment_failed',
      'payment_expired',
      'refunded',
      'chargeback'
    )
  ),
  CONSTRAINT plan_subscription_orders_amount_check CHECK (amount >= 0),
  CONSTRAINT plan_subscription_orders_currency_check CHECK (
    currency = upper(currency)
    AND length(currency) = 3
  )
);

CREATE INDEX IF NOT EXISTS idx_plan_subscription_orders_patient
  ON public.plan_subscription_orders (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plan_subscription_orders_app_user_status
  ON public.plan_subscription_orders (app_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plan_subscription_orders_current_payment_charge
  ON public.plan_subscription_orders (current_payment_charge_id)
  WHERE current_payment_charge_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_subscription_orders_open_plan_unique
  ON public.plan_subscription_orders (app_user_id, plan_code)
  WHERE status IN (
    'pending_payment',
    'payment_confirmed',
    'activating_plan',
    'active',
    'activation_failed'
  );

ALTER TABLE public.plan_subscription_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_subscription_orders FORCE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_plan_subscription_orders_updated_at ON public.plan_subscription_orders;
CREATE TRIGGER update_plan_subscription_orders_updated_at
  BEFORE UPDATE ON public.plan_subscription_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.payment_charges
  DROP CONSTRAINT IF EXISTS payment_charges_owner_type_check;

ALTER TABLE public.payment_charges
  ADD CONSTRAINT payment_charges_owner_type_check CHECK (
    owner_type IN ('appointment', 'queue', 'solicitacao_exame', 'plan_subscription')
  );

COMMIT;
