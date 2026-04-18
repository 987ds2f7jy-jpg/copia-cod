-- Allows webhook reconciliation by provider payment id without touching the original
-- provider_charge_id, which stores the checkout/preference id for Checkout Pro.

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_charges_provider_payment_reference_unique
  ON public.payment_charges (provider, provider_payment_reference)
  WHERE provider <> '' AND provider_payment_reference <> '';
