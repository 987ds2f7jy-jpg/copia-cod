BEGIN;

-- Deprecated compatibility migration.
-- The original version recreated public.app_users and dropped domain data.
-- That behavior is intentionally removed so the migration chain remains safe
-- for `supabase db push` and preserves every domain column from the exports.

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID;

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_app_users_role_active
ON public.app_users (role, is_active);

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT id
  FROM public.app_users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_app_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT role
  FROM public.app_users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

COMMIT;
