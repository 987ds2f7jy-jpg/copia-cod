-- Base tables for platform-controlled prices, fee rules, and external payment tracking.
-- This migration intentionally does not activate any payment gate in business flows.

CREATE TABLE IF NOT EXISTS public.platform_service_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  fee_group TEXT NOT NULL,
  gross_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  active BOOLEAN NOT NULL DEFAULT false,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_service_prices_service_code_check CHECK (
    service_code IN (
      'on_duty_clinico_geral',
      'on_duty_pediatria',
      'on_duty_psicologia',
      'on_duty_psiquiatria',
      'specialty_request',
      'extra_checkup',
      'extra_exames_especificos',
      'extra_renovacao_receitas',
      'extra_laudo_medico'
    )
  ),
  CONSTRAINT platform_service_prices_fee_group_check CHECK (
    fee_group IN ('duty', 'specialty', 'services')
  ),
  CONSTRAINT platform_service_prices_gross_price_check CHECK (gross_price >= 0),
  CONSTRAINT platform_service_prices_currency_check CHECK (
    currency = upper(currency)
    AND length(currency) = 3
  ),
  CONSTRAINT platform_service_prices_effective_window_check CHECK (
    effective_to IS NULL OR effective_to > effective_from
  )
);

CREATE INDEX IF NOT EXISTS idx_platform_service_prices_lookup
  ON public.platform_service_prices (service_code, active, effective_from DESC);

CREATE INDEX IF NOT EXISTS idx_platform_service_prices_fee_group
  ON public.platform_service_prices (fee_group, active, effective_from DESC);

ALTER TABLE public.platform_service_prices ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_platform_service_prices_updated_at ON public.platform_service_prices;
CREATE TRIGGER update_platform_service_prices_updated_at
  BEFORE UPDATE ON public.platform_service_prices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.platform_fee_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_group TEXT NOT NULL,
  service_code TEXT NOT NULL DEFAULT '',
  fee_percent NUMERIC(7,6) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT false,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_fee_rules_fee_group_check CHECK (
    fee_group IN ('profile', 'duty', 'specialty', 'services')
  ),
  CONSTRAINT platform_fee_rules_fee_percent_check CHECK (
    fee_percent >= 0 AND fee_percent <= 1
  ),
  CONSTRAINT platform_fee_rules_effective_window_check CHECK (
    effective_to IS NULL OR effective_to > effective_from
  )
);

CREATE INDEX IF NOT EXISTS idx_platform_fee_rules_group_lookup
  ON public.platform_fee_rules (fee_group, active, effective_from DESC);

CREATE INDEX IF NOT EXISTS idx_platform_fee_rules_service_lookup
  ON public.platform_fee_rules (service_code, active, effective_from DESC)
  WHERE service_code <> '';

ALTER TABLE public.platform_fee_rules ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_platform_fee_rules_updated_at ON public.platform_fee_rules;
CREATE TRIGGER update_platform_fee_rules_updated_at
  BEFORE UPDATE ON public.platform_fee_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.payment_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL,
  owner_id UUID NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  provider TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'payment_pending',
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  external_reference TEXT NOT NULL DEFAULT '',
  provider_idempotency_key TEXT NOT NULL DEFAULT '',
  provider_charge_id TEXT NOT NULL DEFAULT '',
  provider_payment_reference TEXT NOT NULL DEFAULT '',
  provider_checkout_url TEXT NOT NULL DEFAULT '',
  last_provider_status TEXT NOT NULL DEFAULT '',
  last_provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  failure_reason TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  chargeback_at TIMESTAMPTZ,
  CONSTRAINT payment_charges_owner_type_check CHECK (
    owner_type IN ('appointment', 'queue', 'solicitacao_exame')
  ),
  CONSTRAINT payment_charges_attempt_number_check CHECK (attempt_number > 0),
  CONSTRAINT payment_charges_status_check CHECK (
    status IN (
      'payment_pending',
      'payment_processing',
      'paid',
      'payment_failed',
      'payment_expired',
      'refunded',
      'chargeback'
    )
  ),
  CONSTRAINT payment_charges_amount_check CHECK (amount >= 0),
  CONSTRAINT payment_charges_currency_check CHECK (
    currency = upper(currency)
    AND length(currency) = 3
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_charges_owner_attempt_unique
  ON public.payment_charges (owner_type, owner_id, attempt_number);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_charges_external_reference_unique
  ON public.payment_charges (external_reference)
  WHERE external_reference <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_charges_provider_idempotency_unique
  ON public.payment_charges (provider, provider_idempotency_key)
  WHERE provider <> '' AND provider_idempotency_key <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_charges_provider_charge_unique
  ON public.payment_charges (provider, provider_charge_id)
  WHERE provider <> '' AND provider_charge_id <> '';

CREATE INDEX IF NOT EXISTS idx_payment_charges_owner_status
  ON public.payment_charges (owner_type, owner_id, status);

CREATE INDEX IF NOT EXISTS idx_payment_charges_status_expires_at
  ON public.payment_charges (status, expires_at);

ALTER TABLE public.payment_charges ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_payment_charges_updated_at ON public.payment_charges;
CREATE TRIGGER update_payment_charges_updated_at
  BEFORE UPDATE ON public.payment_charges
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT '',
  external_event_id TEXT NOT NULL DEFAULT '',
  event_hash TEXT NOT NULL,
  provider_charge_id TEXT NOT NULL DEFAULT '',
  external_reference TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_charge_id UUID REFERENCES public.payment_charges(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processing_error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_webhook_events_provider_event_unique
  ON public.payment_webhook_events (provider, external_event_id)
  WHERE provider <> '' AND external_event_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_webhook_events_provider_hash_unique
  ON public.payment_webhook_events (provider, event_hash);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_provider_charge
  ON public.payment_webhook_events (provider, provider_charge_id)
  WHERE provider_charge_id <> '';

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_external_reference
  ON public.payment_webhook_events (external_reference)
  WHERE external_reference <> '';

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_processing
  ON public.payment_webhook_events (processed_at, received_at);

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_payment_webhook_events_updated_at ON public.payment_webhook_events;
CREATE TRIGGER update_payment_webhook_events_updated_at
  BEFORE UPDATE ON public.payment_webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
