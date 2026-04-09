-- Phase 3: remove legacy authentication columns from public.app_users
-- Purpose:
--   1. Remove legacy auth fields that should now live only in auth.users.
--   2. Preserve all domain fields, including profile_complete and the domain id.
-- Notes:
--   - This migration is idempotent.
--   - It does not touch domain relationships.

BEGIN;

ALTER TABLE public.app_users
  DROP COLUMN IF EXISTS password_hash,
  DROP COLUMN IF EXISTS session_token,
  DROP COLUMN IF EXISTS token_expires_at;

COMMIT;

-- Validation query for Phase 3
SELECT
  (
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_users'
      AND column_name IN ('password_hash', 'session_token', 'token_expires_at')
  ) AS legacy_auth_columns_remaining,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_users'
      AND column_name = 'profile_complete'
  ) AS profile_complete_still_present;
