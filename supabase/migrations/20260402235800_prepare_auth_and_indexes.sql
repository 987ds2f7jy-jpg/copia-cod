ALTER TABLE public.app_users
ADD COLUMN IF NOT EXISTS auth_user_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_auth_user_id
ON public.app_users (auth_user_id)
WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_professional_profiles_user_status
ON public.professional_profiles (user_id, status);

CREATE INDEX IF NOT EXISTS idx_professional_profiles_duty_specialty
ON public.professional_profiles (is_on_duty, specialty);

CREATE INDEX IF NOT EXISTS idx_professional_public_profiles_lookup
ON public.professional_public_profiles (professional_profile_id, status, specialty);

CREATE INDEX IF NOT EXISTS idx_professional_public_profiles_slug
ON public.professional_public_profiles (slug);

CREATE INDEX IF NOT EXISTS idx_questions_profile_status
ON public.questions (public_profile_id, status);

CREATE INDEX IF NOT EXISTS idx_questions_patient_status
ON public.questions (paciente_id, status);

CREATE INDEX IF NOT EXISTS idx_queues_status_specialty
ON public.queues (status, specialty);

CREATE INDEX IF NOT EXISTS idx_queues_patient_status
ON public.queues (patient_id, status);

CREATE INDEX IF NOT EXISTS idx_consultas_participants_status
ON public.consultas (paciente_id, profissional_id, status);

CREATE INDEX IF NOT EXISTS idx_consultas_datetime
ON public.consultas (datetime);

CREATE INDEX IF NOT EXISTS idx_availability_slots_professional_weekday
ON public.availability_slots (professional_id, weekday);

CREATE INDEX IF NOT EXISTS idx_saques_professional_status
ON public.saques (professional_id, status);

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
