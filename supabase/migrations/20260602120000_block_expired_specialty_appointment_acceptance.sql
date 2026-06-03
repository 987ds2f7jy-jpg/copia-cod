BEGIN;

CREATE OR REPLACE FUNCTION public.accept_appointment_transaction(
  p_appointment_id UUID,
  p_professional_app_user_id TEXT,
  p_professional_profile_id UUID
)
RETURNS TABLE (
  appointment_id UUID,
  appointment_status TEXT,
  appointment_accepted_at TEXT,
  appointment_scheduled_datetime TEXT,
  appointment_professional_id TEXT,
  appointment_professional_name TEXT,
  consulta_id UUID,
  consulta_status TEXT,
  consulta_tipo TEXT,
  consulta_datetime TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_appointment public.appointments%ROWTYPE;
  v_professional RECORD;
  v_consulta_id UUID;
  v_consulta_tipo TEXT;
  v_consulta_service_code TEXT := '';
  v_consulta_preco NUMERIC;
  v_now_text TEXT := to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_scheduled_datetime TEXT;
  v_expiration_cutoff TEXT := to_char(
    timezone('America/Sao_Paulo', now()) - interval '10 minutes',
    'YYYY-MM-DD"T"HH24:MI:SS'
  );
BEGIN
  IF trim(coalesce(p_professional_app_user_id, '')) = '' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'PROFESSIONAL_APP_USER_REQUIRED',
      DETAIL = 'Professional app user id is required.';
  END IF;

  IF p_professional_profile_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'PROFESSIONAL_PROFILE_REQUIRED',
      DETAIL = 'Professional profile id is required.';
  END IF;

  SELECT *
  INTO v_appointment
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'APPOINTMENT_NOT_FOUND',
      DETAIL = 'Appointment does not exist.';
  END IF;

  SELECT
    p.id,
    p.user_id,
    p.full_name,
    p.specialty,
    p.status
  INTO v_professional
  FROM public.professional_profiles AS p
  WHERE p.id = p_professional_profile_id
    AND p.user_id = p_professional_app_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'PROFESSIONAL_PROFILE_NOT_FOUND',
      DETAIL = 'No professional profile matches the authenticated user.';
  END IF;

  IF lower(trim(coalesce(v_professional.status, ''))) <> 'approved' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'PROFESSIONAL_PROFILE_NOT_ELIGIBLE',
      DETAIL = 'Professional profile must be approved.';
  END IF;

  IF coalesce(nullif(trim(v_appointment.status), ''), '') NOT IN ('requested', 'pending', 'SOLICITADO') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'APPOINTMENT_NOT_REQUESTED',
      DETAIL = format('Appointment status is %s.', coalesce(v_appointment.status, '<null>'));
  END IF;

  v_scheduled_datetime := coalesce(
    nullif(trim(v_appointment.scheduled_datetime), ''),
    CASE
      WHEN nullif(trim(v_appointment.date), '') IS NOT NULL
        AND nullif(trim(v_appointment.time), '') IS NOT NULL
      THEN trim(v_appointment.date) || 'T' || trim(v_appointment.time) || ':00'
      ELSE NULL
    END
  );

  IF v_scheduled_datetime IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'APPOINTMENT_SCHEDULE_MISSING',
      DETAIL = 'Appointment must have scheduled_datetime or date/time.';
  END IF;

  IF lower(trim(coalesce(v_appointment.appointment_type, ''))) = 'especialidade'
    AND left(replace(trim(v_scheduled_datetime), ' ', 'T'), 19) < v_expiration_cutoff
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'APPOINTMENT_EXPIRED',
      DETAIL = 'Specialty appointment request is past its acceptance window.';
  END IF;

  IF nullif(trim(coalesce(v_appointment.professional_id, '')), '') IS NOT NULL
    AND trim(v_appointment.professional_id) <> trim(v_professional.id::TEXT) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'PROFESSIONAL_PROFILE_MISMATCH',
      DETAIL = 'Appointment is assigned to a different professional.';
  END IF;

  IF nullif(trim(coalesce(v_appointment.professional_id, '')), '') IS NULL
    AND lower(trim(coalesce(v_appointment.specialty, ''))) <> lower(trim(coalesce(v_professional.specialty, ''))) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'APPOINTMENT_NOT_ELIGIBLE_FOR_PROFESSIONAL',
      DETAIL = 'Professional specialty does not match appointment specialty.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(trim(v_professional.id::TEXT) || '|' || trim(v_scheduled_datetime))
  );

  PERFORM 1
  FROM public.appointments AS a
  WHERE a.id <> v_appointment.id
    AND trim(coalesce(a.professional_id, '')) = trim(v_professional.id::TEXT)
    AND coalesce(
      nullif(trim(a.scheduled_datetime), ''),
      CASE
        WHEN nullif(trim(a.date), '') IS NOT NULL
          AND nullif(trim(a.time), '') IS NOT NULL
        THEN trim(a.date) || 'T' || trim(a.time) || ':00'
        ELSE ''
      END
    ) = v_scheduled_datetime
    AND coalesce(nullif(trim(a.status), ''), '') NOT IN (
      'cancelled',
      'cancelada',
      'CANCELADO',
      'rejected',
      'rejeitado',
      'expired',
      'EXPIRADO'
    )
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'APPOINTMENT_SCHEDULE_CONFLICT',
      DETAIL = 'Professional already has another appointment at this datetime.';
  END IF;

  v_consulta_tipo := CASE
    WHEN lower(trim(coalesce(v_appointment.appointment_type, ''))) IN ('priority', 'prioritario')
      THEN 'prioritario'
    WHEN lower(trim(coalesce(v_appointment.appointment_type, ''))) IN ('instant', 'plantao', 'imediato')
      THEN 'plantao'
    WHEN trim(coalesce(v_appointment.appointment_type, '')) IN ('ESPECIALIDADE', 'especialidade')
      THEN 'especialidade'
    ELSE 'padrao'
  END;

  v_consulta_service_code := coalesce(
    nullif(trim(coalesce(v_appointment.service_code, '')), ''),
    CASE
      WHEN v_consulta_tipo = 'prioritario' THEN 'profile_priority'
      WHEN v_consulta_tipo = 'padrao' THEN 'profile_standard'
      WHEN v_consulta_tipo = 'especialidade' THEN 'specialty_request'
      ELSE ''
    END
  );
  v_consulta_preco := coalesce(v_appointment.gross_price, v_appointment.price);

  IF v_consulta_tipo IN ('especialidade', 'plantao')
    AND (
      trim(coalesce(v_appointment.service_code, '')) = ''
      OR v_appointment.gross_price IS NULL
      OR v_appointment.gross_price <= 0
    ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'APPOINTMENT_PRICING_SNAPSHOT_REQUIRED',
      DETAIL = 'Specialty appointments require an existing pricing snapshot before acceptance.';
  END IF;

  IF v_consulta_preco IS NULL OR v_consulta_preco <= 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'APPOINTMENT_PRICE_SNAPSHOT_INVALID',
      DETAIL = 'Appointment price snapshot must be greater than zero before acceptance.';
  END IF;

  INSERT INTO public.consultas (
    paciente_id,
    paciente_nome,
    paciente_email,
    profissional_id,
    profissional_user_id,
    profissional_nome,
    especialidade,
    tipo_consulta,
    status,
    datetime,
    descricao_sintomas,
    service_code,
    preco
  ) VALUES (
    v_appointment.patient_id,
    coalesce(v_appointment.patient_name, ''),
    coalesce(v_appointment.patient_email, ''),
    v_professional.id::TEXT,
    p_professional_app_user_id,
    coalesce(v_professional.full_name, ''),
    coalesce(v_appointment.specialty, ''),
    v_consulta_tipo,
    'aguardando',
    v_scheduled_datetime,
    coalesce(v_appointment.symptoms, ''),
    v_consulta_service_code,
    v_consulta_preco
  )
  RETURNING id INTO v_consulta_id;

  UPDATE public.appointments
  SET professional_id = v_professional.id::TEXT,
      professional_name = coalesce(v_professional.full_name, ''),
      scheduled_datetime = v_scheduled_datetime,
      status = 'accepted',
      accepted_at = v_now_text,
      consulta_id = v_consulta_id::TEXT,
      price = v_consulta_preco,
      service_code = coalesce(nullif(trim(coalesce(v_appointment.service_code, '')), ''), v_consulta_service_code)
  WHERE id = v_appointment.id;

  RETURN QUERY
  SELECT
    v_appointment.id,
    'accepted'::TEXT,
    v_now_text,
    v_scheduled_datetime,
    v_professional.id::TEXT,
    coalesce(v_professional.full_name, ''),
    v_consulta_id,
    'aguardando'::TEXT,
    v_consulta_tipo,
    v_scheduled_datetime;
END;
$$;

COMMIT;
