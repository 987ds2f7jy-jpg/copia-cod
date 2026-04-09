-- Phase 2: consistency backfill and audit
-- Purpose:
--   1. Surface the current consistency state between public.app_users and auth.users.
--   2. Backfill public.app_users.auth_user_id only when the match is unambiguous.
--   3. Backfill public.consultas.profissional_user_id using professional domain tables.
--   4. Backfill public.professional_public_profiles.user_id from professional_profiles.
-- Notes:
--   - This migration does not delete rows and does not merge duplicates.
--   - Unsafe cases stay visible in the audit output and must be handled manually before Phase 4.

-- Audit 1: duplicate normalized emails inside public.app_users
SELECT
  lower(trim(email)) AS normalized_email,
  count(*) AS total_rows,
  array_agg(id ORDER BY created_date ASC) AS app_user_ids
FROM public.app_users
GROUP BY 1
HAVING count(*) > 1
ORDER BY total_rows DESC, normalized_email;

-- Audit 2: duplicate normalized emails inside auth.users
SELECT
  lower(trim(email)) AS normalized_email,
  count(*) AS total_rows,
  array_agg(id ORDER BY created_at ASC) AS auth_user_ids
FROM auth.users
WHERE email IS NOT NULL
  AND trim(email) <> ''
GROUP BY 1
HAVING count(*) > 1
ORDER BY total_rows DESC, normalized_email;

-- Audit 3: shared auth_user_id values inside public.app_users
SELECT
  auth_user_id,
  count(*) AS total_rows,
  array_agg(id ORDER BY created_date ASC) AS app_user_ids
FROM public.app_users
WHERE auth_user_id IS NOT NULL
GROUP BY auth_user_id
HAVING count(*) > 1
ORDER BY total_rows DESC, auth_user_id;

-- Audit 4: linked rows where app_users.email and auth.users.email disagree
SELECT
  pu.id AS app_user_id,
  pu.email AS app_email,
  pu.auth_user_id,
  au.email AS auth_email
FROM public.app_users AS pu
JOIN auth.users AS au
  ON au.id = pu.auth_user_id
WHERE lower(trim(pu.email)) <> lower(trim(au.email))
ORDER BY pu.email;

-- Audit 5: app_users without auth_user_id but with auth.users email matches.
-- total_auth_rows shows whether the match is unique and therefore safe for automatic backfill.
WITH auth_by_email AS (
  SELECT
    lower(trim(email)) AS normalized_email,
    min(id::text)::uuid AS auth_user_id,
    count(*) AS total_auth_rows
  FROM auth.users
  WHERE email IS NOT NULL
    AND trim(email) <> ''
  GROUP BY 1
)
SELECT
  pu.id AS app_user_id,
  pu.email,
  abe.auth_user_id,
  abe.total_auth_rows
FROM public.app_users AS pu
JOIN auth_by_email AS abe
  ON abe.normalized_email = lower(trim(pu.email))
WHERE pu.auth_user_id IS NULL
ORDER BY pu.email;

-- Audit 6: app_users with broken auth_user_id but with auth.users email matches.
-- total_auth_rows shows whether the match is unique and therefore safe for automatic repair.
WITH auth_by_email AS (
  SELECT
    lower(trim(email)) AS normalized_email,
    min(id::text)::uuid AS auth_user_id,
    count(*) AS total_auth_rows
  FROM auth.users
  WHERE email IS NOT NULL
    AND trim(email) <> ''
  GROUP BY 1
)
SELECT
  pu.id AS app_user_id,
  pu.email,
  pu.auth_user_id AS broken_auth_user_id,
  abe.auth_user_id AS candidate_auth_user_id,
  abe.total_auth_rows
FROM public.app_users AS pu
LEFT JOIN auth.users AS au
  ON au.id = pu.auth_user_id
JOIN auth_by_email AS abe
  ON abe.normalized_email = lower(trim(pu.email))
WHERE pu.auth_user_id IS NOT NULL
  AND au.id IS NULL
ORDER BY pu.email;

-- Audit 7: app_users with no match in auth.users by auth_user_id or by email
SELECT
  pu.id AS app_user_id,
  pu.email,
  pu.auth_user_id,
  pu.role,
  pu.created_date
FROM public.app_users AS pu
LEFT JOIN auth.users AS au_by_id
  ON au_by_id.id = pu.auth_user_id
LEFT JOIN auth.users AS au_by_email
  ON lower(trim(au_by_email.email)) = lower(trim(pu.email))
WHERE au_by_id.id IS NULL
  AND au_by_email.id IS NULL
ORDER BY pu.created_date DESC;

-- Audit 8: auth.users without a linked public.app_users row
SELECT
  au.id AS auth_user_id,
  au.email,
  au.email_confirmed_at,
  au.last_sign_in_at,
  au.created_at
FROM auth.users AS au
LEFT JOIN public.app_users AS pu
  ON pu.auth_user_id = au.id
WHERE pu.id IS NULL
ORDER BY au.created_at DESC;

BEGIN;

-- Safe backfill 1: set auth_user_id when there is exactly one auth.users row for the app_users email.
WITH auth_unique AS (
  SELECT
    lower(trim(email)) AS normalized_email,
    min(id::text)::uuid AS auth_user_id
  FROM auth.users
  WHERE email IS NOT NULL
    AND trim(email) <> ''
  GROUP BY 1
  HAVING count(*) = 1
)
UPDATE public.app_users AS pu
SET
  auth_user_id = au.auth_user_id,
  email = au.normalized_email
FROM auth_unique AS au
WHERE pu.auth_user_id IS NULL
  AND lower(trim(pu.email)) = au.normalized_email;

-- Safe backfill 2: repair broken auth_user_id links when the email resolves to exactly one auth.users row.
WITH auth_unique AS (
  SELECT
    lower(trim(email)) AS normalized_email,
    min(id::text)::uuid AS auth_user_id
  FROM auth.users
  WHERE email IS NOT NULL
    AND trim(email) <> ''
  GROUP BY 1
  HAVING count(*) = 1
),
broken_links AS (
  SELECT
    pu.id,
    au.auth_user_id
  FROM public.app_users AS pu
  LEFT JOIN auth.users AS linked
    ON linked.id = pu.auth_user_id
  JOIN auth_unique AS au
    ON au.normalized_email = lower(trim(pu.email))
  WHERE pu.auth_user_id IS NOT NULL
    AND linked.id IS NULL
)
UPDATE public.app_users AS pu
SET auth_user_id = broken_links.auth_user_id
FROM broken_links
WHERE pu.id = broken_links.id;

-- Safe backfill 3: normalize app_users.email to the linked auth.users email when auth_user_id is already trusted.
UPDATE public.app_users AS pu
SET email = lower(trim(au.email))
FROM auth.users AS au
WHERE pu.auth_user_id = au.id
  AND au.email IS NOT NULL
  AND trim(au.email) <> ''
  AND lower(trim(pu.email)) <> lower(trim(au.email));

-- Safe backfill 4: fill consultas.profissional_user_id from professional_profiles.user_id.
UPDATE public.consultas AS c
SET profissional_user_id = pp.user_id
FROM public.professional_profiles AS pp
WHERE c.profissional_id = pp.id::text
  AND coalesce(c.profissional_user_id, '') = ''
  AND coalesce(pp.user_id, '') <> '';

-- Safe backfill 5: fill consultas.profissional_user_id from professionals.user_id when the profile route is not available.
UPDATE public.consultas AS c
SET profissional_user_id = p.user_id
FROM public.professionals AS p
WHERE c.profissional_id = p.id::text
  AND coalesce(c.profissional_user_id, '') = ''
  AND coalesce(p.user_id, '') <> '';

-- Safe backfill 6: keep a final fallback to profissional_id when no better domain mapping exists yet.
UPDATE public.consultas
SET profissional_user_id = profissional_id
WHERE coalesce(profissional_user_id, '') = ''
  AND coalesce(profissional_id, '') <> '';

-- Safe backfill 7: fill professional_public_profiles.user_id from professional_profiles.user_id.
UPDATE public.professional_public_profiles AS pub
SET user_id = pp.user_id
FROM public.professional_profiles AS pp
WHERE pub.professional_profile_id = pp.id::text
  AND coalesce(pub.user_id, '') = ''
  AND coalesce(pp.user_id, '') <> '';

-- Keep consultas.profissional_user_id in sync for future writes.
CREATE OR REPLACE FUNCTION public.sync_consulta_profissional_user_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(NEW.profissional_user_id, '') = '' THEN
    SELECT pp.user_id
      INTO NEW.profissional_user_id
    FROM public.professional_profiles AS pp
    WHERE pp.id::text = NEW.profissional_id
      AND coalesce(pp.user_id, '') <> ''
    LIMIT 1;

    IF coalesce(NEW.profissional_user_id, '') = '' THEN
      SELECT p.user_id
        INTO NEW.profissional_user_id
      FROM public.professionals AS p
      WHERE p.id::text = NEW.profissional_id
        AND coalesce(p.user_id, '') <> ''
      LIMIT 1;
    END IF;

    IF coalesce(NEW.profissional_user_id, '') = '' THEN
      NEW.profissional_user_id := NEW.profissional_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_consulta_profissional_user_id ON public.consultas;

CREATE TRIGGER set_consulta_profissional_user_id
BEFORE INSERT OR UPDATE OF profissional_id, profissional_user_id
ON public.consultas
FOR EACH ROW
EXECUTE FUNCTION public.sync_consulta_profissional_user_id();

COMMIT;

-- Validation query for Phase 2
SELECT
  (
    SELECT count(*)
    FROM public.app_users
    WHERE auth_user_id IS NULL
  ) AS app_users_without_auth_user_id,
  (
    SELECT count(*)
    FROM public.app_users AS pu
    LEFT JOIN auth.users AS au
      ON au.id = pu.auth_user_id
    WHERE pu.auth_user_id IS NOT NULL
      AND au.id IS NULL
  ) AS app_users_with_broken_auth_user_id,
  (
    SELECT count(*)
    FROM public.consultas
    WHERE coalesce(profissional_user_id, '') = ''
  ) AS consultas_without_profissional_user_id,
  (
    SELECT count(*)
    FROM public.professional_public_profiles
    WHERE coalesce(user_id, '') = ''
  ) AS public_profiles_without_user_id;
