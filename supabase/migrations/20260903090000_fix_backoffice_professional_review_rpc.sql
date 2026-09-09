BEGIN;

-- The previous version exposed output variables named "professional_profile_id"
-- and "status". They conflicted with unqualified columns in the public-profile
-- UPDATE, causing PL/pgSQL to reject reviews as ambiguous at runtime.
CREATE OR REPLACE FUNCTION public.review_backoffice_professional(
  p_professional_profile_id UUID,
  p_admin_user_id UUID,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  professional_profile_id UUID,
  status TEXT,
  is_verified BOOLEAN
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_next_status TEXT;
  v_profile public.professional_profiles%ROWTYPE;
BEGIN
  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BACKOFFICE_ACTION_INVALID';
  END IF;

  SELECT * INTO v_profile
  FROM public.professional_profiles AS private_profile
  WHERE private_profile.id = p_professional_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROFESSIONAL_PROFILE_NOT_FOUND';
  END IF;

  IF v_profile.status <> 'pending' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROFESSIONAL_PROFILE_NOT_PENDING';
  END IF;

  v_next_status := CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END;

  UPDATE public.professional_profiles AS private_profile
  SET status = v_next_status,
      is_verified = (p_action = 'approve'),
      is_on_duty = false
  WHERE private_profile.id = p_professional_profile_id;

  -- Keep the current public projection aligned, but never create or match it by
  -- email/name and never overwrite a public profile already reviewed elsewhere.
  UPDATE public.professional_public_profiles AS public_profile
  SET status = v_next_status,
      is_on_duty = false
  WHERE public_profile.professional_profile_id = p_professional_profile_id::TEXT
    AND public_profile.status = 'pending_review';

  INSERT INTO public.backoffice_audit_events (admin_user_id, action, entity_type, entity_id, metadata)
  VALUES (
    p_admin_user_id,
    CASE WHEN p_action = 'approve' THEN 'professional.approved' ELSE 'professional.rejected' END,
    'professional_profile',
    p_professional_profile_id,
    jsonb_build_object(
      'reason', left(coalesce(p_reason, ''), 500),
      'previous_status', 'pending',
      'next_status', v_next_status
    )
  );

  RETURN QUERY
  SELECT private_profile.id, private_profile.status, private_profile.is_verified
  FROM public.professional_profiles AS private_profile
  WHERE private_profile.id = p_professional_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.review_backoffice_professional(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_backoffice_professional(UUID, UUID, TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
