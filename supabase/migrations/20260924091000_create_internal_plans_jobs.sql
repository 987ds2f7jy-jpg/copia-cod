BEGIN;

CREATE TABLE public.internal_plans_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  worker_id TEXT,
  result JSONB NOT NULL DEFAULT '{}'::JSONB,
  error_code TEXT,
  error_message TEXT,
  last_error_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT internal_plans_jobs_type_check CHECK (
    job_type IN (
      'activate_plan_subscription',
      'retry_plan_activation',
      'refresh_monthly_subscription_scores',
      'disable_expired_subscription_scores',
      'reconcile_plan_credit',
      'sync_external_access'
    )
  ),
  CONSTRAINT internal_plans_jobs_status_check CHECK (
    status IN ('pending', 'processing', 'succeeded', 'dead_letter')
  )
);

CREATE INDEX idx_internal_plans_jobs_claim
  ON public.internal_plans_jobs (status, available_at, created_at)
  WHERE status = 'pending';

CREATE INDEX idx_internal_plans_jobs_stale
  ON public.internal_plans_jobs (locked_until)
  WHERE status = 'processing';

ALTER TABLE public.internal_plans_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_plans_jobs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.internal_plans_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.internal_plans_jobs TO service_role;

DROP TRIGGER IF EXISTS update_internal_plans_jobs_updated_at ON public.internal_plans_jobs;
CREATE TRIGGER update_internal_plans_jobs_updated_at
  BEFORE UPDATE ON public.internal_plans_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enqueue_internal_plans_job(
  p_job_type TEXT,
  p_idempotency_key TEXT,
  p_payload JSONB DEFAULT '{}'::JSONB,
  p_available_at TIMESTAMPTZ DEFAULT now(),
  p_max_attempts INTEGER DEFAULT 5
)
RETURNS public.internal_plans_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job public.internal_plans_jobs%ROWTYPE;
BEGIN
  INSERT INTO public.internal_plans_jobs (
    job_type, idempotency_key, payload, available_at, max_attempts
  ) VALUES (
    p_job_type,
    trim(p_idempotency_key),
    coalesce(p_payload, '{}'::JSONB),
    coalesce(p_available_at, now()),
    greatest(1, p_max_attempts)
  )
  ON CONFLICT (idempotency_key) DO UPDATE SET
    payload = CASE
      WHEN public.internal_plans_jobs.status IN ('pending', 'processing')
      THEN EXCLUDED.payload
      ELSE public.internal_plans_jobs.payload
    END,
    updated_at = now()
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_internal_plans_jobs(
  p_worker_id TEXT,
  p_limit INTEGER DEFAULT 10,
  p_lock_seconds INTEGER DEFAULT 300
)
RETURNS SETOF public.internal_plans_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.internal_plans_jobs
  SET status = CASE WHEN attempts >= max_attempts THEN 'dead_letter' ELSE 'pending' END,
      worker_id = NULL,
      locked_at = NULL,
      locked_until = NULL,
      available_at = CASE WHEN attempts >= max_attempts THEN available_at ELSE now() END,
      error_code = coalesce(error_code, 'PLAN_JOB_LOCK_EXPIRED'),
      error_message = coalesce(error_message, 'Worker lock expired before completion.'),
      last_error_at = coalesce(last_error_at, now()),
      updated_at = now()
  WHERE status = 'processing'
    AND locked_until <= now();

  RETURN QUERY
  WITH candidates AS (
    SELECT job.id
    FROM public.internal_plans_jobs AS job
    WHERE job.status = 'pending'
      AND job.available_at <= now()
    ORDER BY job.available_at, job.created_at
    LIMIT greatest(1, least(p_limit, 50))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.internal_plans_jobs AS job
  SET status = 'processing',
      attempts = job.attempts + 1,
      worker_id = trim(p_worker_id),
      locked_at = now(),
      locked_until = now() + make_interval(secs => greatest(30, p_lock_seconds)),
      error_code = NULL,
      error_message = NULL,
      updated_at = now()
  FROM candidates
  WHERE job.id = candidates.id
  RETURNING job.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_internal_plans_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_result JSONB DEFAULT '{}'::JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.internal_plans_jobs
  SET status = 'succeeded',
      result = coalesce(p_result, '{}'::JSONB),
      completed_at = now(),
      locked_at = NULL,
      locked_until = NULL,
      worker_id = NULL,
      error_code = NULL,
      error_message = NULL,
      updated_at = now()
  WHERE id = p_job_id
    AND status = 'processing'
    AND worker_id = trim(p_worker_id);

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_internal_plans_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_error_code TEXT,
  p_error_message TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job public.internal_plans_jobs%ROWTYPE;
  v_next_status TEXT;
BEGIN
  SELECT * INTO v_job
  FROM public.internal_plans_jobs
  WHERE id = p_job_id
    AND status = 'processing'
    AND worker_id = trim(p_worker_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_claimed';
  END IF;

  v_next_status := CASE WHEN v_job.attempts >= v_job.max_attempts THEN 'dead_letter' ELSE 'pending' END;

  UPDATE public.internal_plans_jobs
  SET status = v_next_status,
      available_at = CASE
        WHEN v_next_status = 'pending'
        THEN now() + make_interval(secs => least(3600, 15 * power(2, greatest(0, attempts - 1))::INTEGER))
        ELSE available_at
      END,
      locked_at = NULL,
      locked_until = NULL,
      worker_id = NULL,
      error_code = left(trim(coalesce(p_error_code, 'PLAN_JOB_FAILED')), 120),
      error_message = left(trim(coalesce(p_error_message, 'Internal Plans job failed.')), 1000),
      last_error_at = now(),
      updated_at = now()
  WHERE id = p_job_id;

  RETURN v_next_status;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_internal_plans_job(TEXT, TEXT, JSONB, TIMESTAMPTZ, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_internal_plans_jobs(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_internal_plans_job(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_internal_plans_job(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_internal_plans_job(TEXT, TEXT, JSONB, TIMESTAMPTZ, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_internal_plans_jobs(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_internal_plans_job(UUID, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_internal_plans_job(UUID, TEXT, TEXT, TEXT) TO service_role;

COMMIT;
