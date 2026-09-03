BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_users_email_normalized_check CHECK (email = lower(trim(email)) AND email <> ''),
  CONSTRAINT admin_users_password_hash_nonempty_check CHECK (length(trim(password_hash)) > 0)
);

CREATE TABLE IF NOT EXISTS public.backoffice_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT backoffice_audit_events_action_nonempty_check CHECK (length(trim(action)) > 0),
  CONSTRAINT backoffice_audit_events_entity_type_nonempty_check CHECK (length(trim(entity_type)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_backoffice_audit_events_admin_created_at
  ON public.backoffice_audit_events (admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_backoffice_audit_events_entity
  ON public.backoffice_audit_events (entity_type, entity_id, created_at DESC);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.backoffice_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backoffice_audit_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_users FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.backoffice_audit_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.admin_users TO service_role;
GRANT ALL ON TABLE public.backoffice_audit_events TO service_role;

DROP TRIGGER IF EXISTS update_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

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
  FROM public.professional_profiles
  WHERE id = p_professional_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROFESSIONAL_PROFILE_NOT_FOUND';
  END IF;

  IF v_profile.status <> 'pending' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROFESSIONAL_PROFILE_NOT_PENDING';
  END IF;

  v_next_status := CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END;

  UPDATE public.professional_profiles
  SET status = v_next_status,
      is_verified = (p_action = 'approve'),
      is_on_duty = false
  WHERE id = p_professional_profile_id;

  -- The public projection is part of the current professional lifecycle. Keep it aligned
  -- when it is still pending without widening this backoffice action to other states.
  UPDATE public.professional_public_profiles
  SET status = v_next_status,
      is_on_duty = false
  WHERE professional_profile_id = p_professional_profile_id::TEXT
    AND status = 'pending_review';

  INSERT INTO public.backoffice_audit_events (admin_user_id, action, entity_type, entity_id, metadata)
  VALUES (
    p_admin_user_id,
    CASE WHEN p_action = 'approve' THEN 'professional.approved' ELSE 'professional.rejected' END,
    'professional_profile',
    p_professional_profile_id,
    jsonb_build_object('reason', left(coalesce(p_reason, ''), 500), 'previous_status', 'pending', 'next_status', v_next_status)
  );

  RETURN QUERY
  SELECT p.id, p.status, p.is_verified
  FROM public.professional_profiles AS p
  WHERE p.id = p_professional_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.review_backoffice_professional(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_backoffice_professional(UUID, UUID, TEXT, TEXT) TO service_role;

COMMIT;
