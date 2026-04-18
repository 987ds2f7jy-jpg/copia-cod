-- Nullable financial snapshots and payment status fields for existing operational tables.
-- Business-flow payment guards are intentionally left for a later rollout.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS service_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_source TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gross_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC(7,6),
  ADD COLUMN IF NOT EXISTS platform_fee_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS professional_net_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS pricing_rule_id UUID REFERENCES public.platform_service_prices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fee_rule_id UUID REFERENCES public.platform_fee_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pricing_estimated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'payment_pending',
  ADD COLUMN IF NOT EXISTS payment_required BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS current_payment_charge_id UUID REFERENCES public.payment_charges(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_price_source_check
    CHECK (price_source IN ('', 'professional_profile', 'platform_fixed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_financial_amounts_check
    CHECK (
      (gross_price IS NULL OR gross_price >= 0)
      AND (platform_fee_amount IS NULL OR platform_fee_amount >= 0)
      AND (professional_net_amount IS NULL OR professional_net_amount >= 0)
      AND (
        platform_fee_percent IS NULL
        OR (platform_fee_percent >= 0 AND platform_fee_percent <= 1)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_payment_status_check
    CHECK (
      payment_status IN (
        'payment_pending',
        'payment_processing',
        'paid',
        'payment_failed',
        'payment_expired',
        'refunded',
        'chargeback'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_service_code
  ON public.appointments (service_code)
  WHERE service_code <> '';

CREATE INDEX IF NOT EXISTS idx_appointments_payment_status
  ON public.appointments (payment_status);

CREATE INDEX IF NOT EXISTS idx_appointments_current_payment_charge
  ON public.appointments (current_payment_charge_id)
  WHERE current_payment_charge_id IS NOT NULL;


ALTER TABLE public.queues
  ADD COLUMN IF NOT EXISTS service_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_source TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS quoted_gross_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS quoted_platform_fee_percent NUMERIC(7,6),
  ADD COLUMN IF NOT EXISTS quoted_platform_fee_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS quoted_professional_net_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS pricing_rule_id UUID REFERENCES public.platform_service_prices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fee_rule_id UUID REFERENCES public.platform_fee_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'payment_pending',
  ADD COLUMN IF NOT EXISTS payment_required BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS current_payment_charge_id UUID REFERENCES public.payment_charges(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE public.queues
    ADD CONSTRAINT queues_price_source_check
    CHECK (price_source IN ('', 'professional_profile', 'platform_fixed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.queues
    ADD CONSTRAINT queues_financial_amounts_check
    CHECK (
      (quoted_gross_price IS NULL OR quoted_gross_price >= 0)
      AND (quoted_platform_fee_amount IS NULL OR quoted_platform_fee_amount >= 0)
      AND (quoted_professional_net_amount IS NULL OR quoted_professional_net_amount >= 0)
      AND (
        quoted_platform_fee_percent IS NULL
        OR (quoted_platform_fee_percent >= 0 AND quoted_platform_fee_percent <= 1)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.queues
    ADD CONSTRAINT queues_payment_status_check
    CHECK (
      payment_status IN (
        'payment_pending',
        'payment_processing',
        'paid',
        'payment_failed',
        'payment_expired',
        'refunded',
        'chargeback'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_queues_service_code
  ON public.queues (service_code)
  WHERE service_code <> '';

CREATE INDEX IF NOT EXISTS idx_queues_payment_status
  ON public.queues (payment_status);

CREATE INDEX IF NOT EXISTS idx_queues_current_payment_charge
  ON public.queues (current_payment_charge_id)
  WHERE current_payment_charge_id IS NOT NULL;


ALTER TABLE public.solicitacoes_exames
  ADD COLUMN IF NOT EXISTS service_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_source TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS quoted_gross_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS quoted_platform_fee_percent NUMERIC(7,6),
  ADD COLUMN IF NOT EXISTS quoted_platform_fee_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS quoted_professional_net_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS pricing_rule_id UUID REFERENCES public.platform_service_prices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fee_rule_id UUID REFERENCES public.platform_fee_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'payment_pending',
  ADD COLUMN IF NOT EXISTS payment_required BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS current_payment_charge_id UUID REFERENCES public.payment_charges(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE public.solicitacoes_exames
    ADD CONSTRAINT solicitacoes_exames_price_source_check
    CHECK (price_source IN ('', 'professional_profile', 'platform_fixed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.solicitacoes_exames
    ADD CONSTRAINT solicitacoes_exames_financial_amounts_check
    CHECK (
      (quoted_gross_price IS NULL OR quoted_gross_price >= 0)
      AND (quoted_platform_fee_amount IS NULL OR quoted_platform_fee_amount >= 0)
      AND (quoted_professional_net_amount IS NULL OR quoted_professional_net_amount >= 0)
      AND (
        quoted_platform_fee_percent IS NULL
        OR (quoted_platform_fee_percent >= 0 AND quoted_platform_fee_percent <= 1)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.solicitacoes_exames
    ADD CONSTRAINT solicitacoes_exames_payment_status_check
    CHECK (
      payment_status IN (
        'payment_pending',
        'payment_processing',
        'paid',
        'payment_failed',
        'payment_expired',
        'refunded',
        'chargeback'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_solicitacoes_exames_service_code
  ON public.solicitacoes_exames (service_code)
  WHERE service_code <> '';

CREATE INDEX IF NOT EXISTS idx_solicitacoes_exames_payment_status
  ON public.solicitacoes_exames (payment_status);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_exames_current_payment_charge
  ON public.solicitacoes_exames (current_payment_charge_id)
  WHERE current_payment_charge_id IS NOT NULL;


ALTER TABLE public.consultas
  ADD COLUMN IF NOT EXISTS service_code TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_consultas_service_code
  ON public.consultas (service_code)
  WHERE service_code <> '';
