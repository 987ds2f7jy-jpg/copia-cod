-- Phase 4: strengthen the public.app_users contract
-- Purpose:
--   1. Make public.app_users.auth_user_id mandatory and unique.
--   2. Enforce the foreign key to auth.users(id) with ON DELETE CASCADE.
--   3. Enforce normalized emails and restore helper functions for domain lookups.
-- Notes:
--   - This migration intentionally refuses to continue when the data is still inconsistent.
--   - Run the Phase 2 audit output and manual fixes before retrying if any guard fails.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_users'
      AND column_name = 'auth_user_id'
  ) THEN
    RAISE EXCEPTION 'Phase 4 requires public.app_users.auth_user_id. Run 20260409000100 first.';
  END IF;
END
$$;

DO $$
DECLARE
  duplicate_app_user_email_groups INTEGER;
  duplicate_auth_email_groups INTEGER;
  shared_auth_user_id_groups INTEGER;
  null_auth_user_id_rows INTEGER;
  broken_auth_user_id_rows INTEGER;
  orphan_auth_users INTEGER;
BEGIN
  SELECT count(*)
    INTO duplicate_app_user_email_groups
  FROM (
    SELECT lower(trim(email))
    FROM public.app_users
    GROUP BY 1
    HAVING count(*) > 1
  ) AS duplicates;

  SELECT count(*)
    INTO duplicate_auth_email_groups
  FROM (
    SELECT lower(trim(email))
    FROM auth.users
    WHERE email IS NOT NULL
      AND trim(email) <> ''
    GROUP BY 1
    HAVING count(*) > 1
  ) AS duplicates;

  SELECT count(*)
    INTO shared_auth_user_id_groups
  FROM (
    SELECT auth_user_id
    FROM public.app_users
    WHERE auth_user_id IS NOT NULL
    GROUP BY 1
    HAVING count(*) > 1
  ) AS duplicates;

  SELECT count(*)
    INTO null_auth_user_id_rows
  FROM public.app_users
  WHERE auth_user_id IS NULL;

  SELECT count(*)
    INTO broken_auth_user_id_rows
  FROM public.app_users AS pu
  LEFT JOIN auth.users AS au
    ON au.id = pu.auth_user_id
  WHERE pu.auth_user_id IS NOT NULL
    AND au.id IS NULL;

  SELECT count(*)
    INTO orphan_auth_users
  FROM auth.users AS au
  LEFT JOIN public.app_users AS pu
    ON pu.auth_user_id = au.id
  WHERE pu.id IS NULL;

  IF duplicate_app_user_email_groups > 0 THEN
    RAISE EXCEPTION 'Phase 4 blocked: % duplicate normalized email group(s) still exist in public.app_users.', duplicate_app_user_email_groups;
  END IF;

  IF duplicate_auth_email_groups > 0 THEN
    RAISE EXCEPTION 'Phase 4 blocked: % duplicate normalized email group(s) still exist in auth.users.', duplicate_auth_email_groups;
  END IF;

  IF shared_auth_user_id_groups > 0 THEN
    RAISE EXCEPTION 'Phase 4 blocked: % auth_user_id value(s) are still shared by multiple public.app_users rows.', shared_auth_user_id_groups;
  END IF;

  IF null_auth_user_id_rows > 0 THEN
    RAISE EXCEPTION 'Phase 4 blocked: % public.app_users row(s) still have auth_user_id = NULL.', null_auth_user_id_rows;
  END IF;

  IF broken_auth_user_id_rows > 0 THEN
    RAISE EXCEPTION 'Phase 4 blocked: % public.app_users row(s) still point to missing auth.users records.', broken_auth_user_id_rows;
  END IF;

  IF orphan_auth_users > 0 THEN
    RAISE EXCEPTION 'Phase 4 blocked: % auth.users row(s) still do not have a linked public.app_users row.', orphan_auth_users;
  END IF;
END
$$;

UPDATE public.app_users
SET email = lower(trim(email))
WHERE email <> lower(trim(email));

UPDATE public.app_users
SET is_active = true
WHERE is_active IS NULL;

ALTER TABLE public.app_users
  ALTER COLUMN auth_user_id SET NOT NULL;

ALTER TABLE public.app_users
  ALTER COLUMN is_active SET DEFAULT true;

ALTER TABLE public.app_users
  ALTER COLUMN is_active SET NOT NULL;

DROP INDEX IF EXISTS public.idx_app_users_auth_user_id;
DROP INDEX IF EXISTS public.idx_app_users_auth_user_id_partial;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint AS c
    JOIN pg_attribute AS a
      ON a.attrelid = c.conrelid
     AND a.attnum = c.conkey[1]
    WHERE c.contype = 'u'
      AND c.conrelid = 'public.app_users'::regclass
      AND array_length(c.conkey, 1) = 1
      AND a.attname = 'auth_user_id'
  ) THEN
    ALTER TABLE public.app_users
      ADD CONSTRAINT app_users_auth_user_id_key UNIQUE (auth_user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint AS c
    JOIN pg_attribute AS a
      ON a.attrelid = c.conrelid
     AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.app_users'::regclass
      AND c.confrelid = 'auth.users'::regclass
      AND array_length(c.conkey, 1) = 1
      AND a.attname = 'auth_user_id'
  ) THEN
    ALTER TABLE public.app_users
      ADD CONSTRAINT app_users_auth_user_id_fkey
      FOREIGN KEY (auth_user_id)
      REFERENCES auth.users (id)
      ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_users_email_normalized_chk'
      AND conrelid = 'public.app_users'::regclass
  ) THEN
    ALTER TABLE public.app_users
      ADD CONSTRAINT app_users_email_normalized_chk
      CHECK (email = lower(trim(email)));
  END IF;
END
$$;

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

-- Validation query for Phase 4
SELECT
  (
    SELECT count(*)
    FROM public.app_users
    WHERE auth_user_id IS NULL
  ) AS auth_user_id_null_rows,
  (
    SELECT count(*)
    FROM (
      SELECT auth_user_id
      FROM public.app_users
      GROUP BY 1
      HAVING count(*) > 1
    ) AS duplicates
  ) AS duplicate_auth_user_id_groups,
  (
    SELECT count(*)
    FROM public.app_users AS pu
    LEFT JOIN auth.users AS au
      ON au.id = pu.auth_user_id
    WHERE pu.auth_user_id IS NOT NULL
      AND au.id IS NULL
  ) AS broken_auth_fk_rows,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_users'
      AND column_name = 'auth_user_id'
      AND is_nullable = 'NO'
  ) AS auth_user_id_is_not_null,
  EXISTS (
    SELECT 1
    FROM pg_constraint AS c
    JOIN pg_attribute AS a
      ON a.attrelid = c.conrelid
     AND a.attnum = c.conkey[1]
    WHERE c.contype = 'u'
      AND c.conrelid = 'public.app_users'::regclass
      AND array_length(c.conkey, 1) = 1
      AND a.attname = 'auth_user_id'
  ) AS has_auth_user_id_unique_constraint,
  EXISTS (
    SELECT 1
    FROM pg_constraint AS c
    JOIN pg_attribute AS a
      ON a.attrelid = c.conrelid
     AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.app_users'::regclass
      AND c.confrelid = 'auth.users'::regclass
      AND array_length(c.conkey, 1) = 1
      AND a.attname = 'auth_user_id'
  ) AS has_auth_user_id_fk,
  EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'current_app_user_id'
  ) AS has_current_app_user_id_function,
  EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'current_app_user_role'
  ) AS has_current_app_user_role_function;
