-- Allow platform-controlled specialty appointments to keep one service_code
-- while resolving different gross prices per selected specialty.

ALTER TABLE public.platform_service_prices
  ADD COLUMN IF NOT EXISTS specialty_code TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_platform_service_prices_specialty_lookup
  ON public.platform_service_prices (service_code, specialty_code, active, effective_from DESC);
