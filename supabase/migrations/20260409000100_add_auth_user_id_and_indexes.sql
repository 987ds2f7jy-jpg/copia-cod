-- Phase 1: preparation
-- Purpose:
--   1. Add the auth_user_id column to public.app_users without removing any domain column.
--   2. Add the profissional_user_id column to public.consultas when it is missing.
--   3. Add the indexes needed for safe backfills and later constraints.
-- Notes:
--   - This migration is additive and idempotent.
--   - It preserves all domain columns from the exports, including profile_complete.

BEGIN;

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID;

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN DEFAULT false;

ALTER TABLE public.consultas
  ADD COLUMN IF NOT EXISTS profissional_user_id TEXT DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_auth_user_id_partial
  ON public.app_users (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_users_email_lower
  ON public.app_users ((lower(trim(email))));

CREATE INDEX IF NOT EXISTS idx_consultas_profissional_user_status
  ON public.consultas (profissional_user_id, status);

CREATE INDEX IF NOT EXISTS idx_professional_public_profiles_user_id
  ON public.professional_public_profiles (user_id);

COMMIT;

-- Validation query for Phase 1
SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_users'
      AND column_name = 'auth_user_id'
  ) AS app_users_has_auth_user_id,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'consultas'
      AND column_name = 'profissional_user_id'
  ) AS consultas_has_profissional_user_id,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_users'
      AND column_name = 'profile_complete'
  ) AS app_users_has_profile_complete,
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_app_users_auth_user_id_partial'
  ) AS has_idx_app_users_auth_user_id_partial,
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_app_users_email_lower'
  ) AS has_idx_app_users_email_lower,
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_consultas_profissional_user_status'
  ) AS has_idx_consultas_profissional_user_status,
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_professional_public_profiles_user_id'
  ) AS has_idx_professional_public_profiles_user_id;
