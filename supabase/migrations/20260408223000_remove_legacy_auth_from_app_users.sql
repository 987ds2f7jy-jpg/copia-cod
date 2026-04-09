BEGIN;

-- Reconstroi public.app_users em um modelo enxuto e 100% baseado em Supabase Auth.
-- Esta migration e destrutiva: dados existentes em app_users nao sao preservados.

DROP FUNCTION IF EXISTS public.current_app_user_id();
DROP FUNCTION IF EXISTS public.current_app_user_role();

DROP TABLE IF EXISTS public.app_users CASCADE;

CREATE TABLE public.app_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'professional', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  phone TEXT NOT NULL DEFAULT '',
  cpf TEXT NOT NULL DEFAULT '',
  birth_date TEXT NOT NULL DEFAULT '',
  sex TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_users_email_not_blank CHECK (trim(email) <> ''),
  CONSTRAINT app_users_email_normalized CHECK (email = lower(trim(email))),
  CONSTRAINT app_users_full_name_not_blank CHECK (trim(full_name) <> '')
);

CREATE INDEX idx_app_users_role_active
ON public.app_users (role, is_active);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access"
ON public.app_users
FOR ALL
USING (true)
WITH CHECK (true);

DROP TRIGGER IF EXISTS update_app_users_updated_at ON public.app_users;

CREATE TRIGGER update_app_users_updated_at
BEFORE UPDATE ON public.app_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

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
