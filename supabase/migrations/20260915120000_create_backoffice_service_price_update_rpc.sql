BEGIN;

CREATE OR REPLACE FUNCTION public.update_backoffice_service_price(
  p_service_price_id UUID,
  p_gross_price NUMERIC,
  p_active BOOLEAN,
  p_admin_user_id UUID
)
RETURNS TABLE (
  id UUID,
  service_code TEXT,
  specialty_code TEXT,
  display_name TEXT,
  fee_group TEXT,
  gross_price NUMERIC,
  currency TEXT,
  active BOOLEAN,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_previous public.platform_service_prices%ROWTYPE;
  v_action TEXT;
BEGIN
  IF p_service_price_id IS NULL OR p_admin_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERVICE_PRICE_UPDATE_INVALID';
  END IF;

  IF p_gross_price IS NULL
    OR p_gross_price < 0
    OR p_gross_price > 9999999999.99
    OR p_gross_price <> round(p_gross_price, 2)
    OR p_active IS NULL
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERVICE_PRICE_UPDATE_INVALID';
  END IF;

  SELECT service_price.*
  INTO v_previous
  FROM public.platform_service_prices AS service_price
  WHERE service_price.id = p_service_price_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERVICE_PRICE_NOT_FOUND';
  END IF;

  IF v_previous.gross_price = p_gross_price
    AND v_previous.active = p_active
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERVICE_PRICE_NO_CHANGES';
  END IF;

  v_action := CASE
    WHEN v_previous.active IS DISTINCT FROM p_active AND p_active
      THEN 'service_price.activated'
    WHEN v_previous.active IS DISTINCT FROM p_active AND NOT p_active
      THEN 'service_price.deactivated'
    ELSE 'service_price.updated'
  END;

  UPDATE public.platform_service_prices AS service_price
  SET gross_price = p_gross_price,
      active = p_active
  WHERE service_price.id = p_service_price_id;

  INSERT INTO public.backoffice_audit_events (
    admin_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    p_admin_user_id,
    v_action,
    'platform_service_prices',
    p_service_price_id,
    jsonb_build_object(
      'previous', jsonb_build_object(
        'gross_price', v_previous.gross_price,
        'active', v_previous.active
      ),
      'current', jsonb_build_object(
        'gross_price', p_gross_price,
        'active', p_active
      )
    )
  );

  RETURN QUERY
  SELECT
    service_price.id,
    service_price.service_code,
    service_price.specialty_code,
    service_price.display_name,
    service_price.fee_group,
    service_price.gross_price,
    service_price.currency,
    service_price.active,
    service_price.effective_from,
    service_price.effective_to,
    service_price.created_at,
    service_price.updated_at
  FROM public.platform_service_prices AS service_price
  WHERE service_price.id = p_service_price_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_backoffice_service_price(UUID, NUMERIC, BOOLEAN, UUID)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.update_backoffice_service_price(UUID, NUMERIC, BOOLEAN, UUID)
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
