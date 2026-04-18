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


CREATE OR REPLACE FUNCTION public.accept_queue_entry_transaction(
  p_queue_id UUID,
  p_professional_app_user_id TEXT,
  p_professional_profile_id UUID
)
RETURNS TABLE (
  queue_id UUID,
  queue_status TEXT,
  queue_assigned_professional_id TEXT,
  queue_patient_id TEXT,
  queue_patient_name TEXT,
  queue_specialty TEXT,
  queue_position INTEGER,
  queue_estimated_wait_time INTEGER,
  queue_solicitacao_exame_id TEXT,
  consulta_id UUID,
  consulta_status TEXT,
  consulta_tipo TEXT,
  consulta_datetime TEXT,
  consulta_professional_id TEXT,
  consulta_professional_user_id TEXT,
  consulta_professional_name TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_queue public.queues%ROWTYPE;
  v_solicitacao public.solicitacoes_exames%ROWTYPE;
  v_has_solicitacao BOOLEAN := false;
  v_professional RECORD;
  v_consulta_id UUID;
  v_now_text TEXT := to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_now_local TIMESTAMP := timezone('America/Sao_Paulo', now());
  v_appointment_date TEXT := to_char(v_now_local, 'YYYY-MM-DD');
  v_appointment_time TEXT := to_char(v_now_local, 'HH24:MI');
  v_has_public_profile BOOLEAN := false;
  v_public_profile_specialty TEXT := '';
  v_public_profile_status TEXT := '';
  v_public_profile_is_on_duty BOOLEAN := NULL;
  v_professional_specialty TEXT := '';
  v_professional_specialty_normalized TEXT := '';
  v_queue_specialty_normalized TEXT := '';
  v_professional_is_on_duty BOOLEAN := false;
  v_snapshot_service_code TEXT := '';
  v_snapshot_price_source TEXT := '';
  v_snapshot_gross_price NUMERIC;
  v_snapshot_fee_percent NUMERIC;
  v_snapshot_fee_amount NUMERIC;
  v_snapshot_net_amount NUMERIC;
  v_snapshot_pricing_rule_id UUID;
  v_snapshot_fee_rule_id UUID;
  v_snapshot_payment_status TEXT := '';
  v_snapshot_current_payment_charge_id UUID;
  v_snapshot_paid_at TIMESTAMPTZ;
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
  INTO v_queue
  FROM public.queues
  WHERE id = p_queue_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'QUEUE_NOT_FOUND',
      DETAIL = 'Queue entry does not exist.';
  END IF;

  IF nullif(trim(coalesce(v_queue.solicitacao_exame_id, '')), '') IS NOT NULL THEN
    SELECT *
    INTO v_solicitacao
    FROM public.solicitacoes_exames
    WHERE id::TEXT = trim(v_queue.solicitacao_exame_id)
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'SOLICITACAO_EXAME_NOT_FOUND_FOR_QUEUE',
        DETAIL = 'Queue references an exam request that does not exist.';
    END IF;

    v_has_solicitacao := true;
  END IF;

  IF v_has_solicitacao THEN
    v_snapshot_service_code := trim(coalesce(v_solicitacao.service_code, ''));
    v_snapshot_price_source := trim(coalesce(v_solicitacao.price_source, ''));
    v_snapshot_gross_price := v_solicitacao.quoted_gross_price;
    v_snapshot_fee_percent := v_solicitacao.quoted_platform_fee_percent;
    v_snapshot_fee_amount := v_solicitacao.quoted_platform_fee_amount;
    v_snapshot_net_amount := v_solicitacao.quoted_professional_net_amount;
    v_snapshot_pricing_rule_id := v_solicitacao.pricing_rule_id;
    v_snapshot_fee_rule_id := v_solicitacao.fee_rule_id;
    v_snapshot_payment_status := trim(coalesce(v_solicitacao.payment_status, ''));
    v_snapshot_current_payment_charge_id := v_solicitacao.current_payment_charge_id;
    v_snapshot_paid_at := v_solicitacao.paid_at;
  ELSE
    v_snapshot_service_code := trim(coalesce(v_queue.service_code, ''));
    v_snapshot_price_source := trim(coalesce(v_queue.price_source, ''));
    v_snapshot_gross_price := v_queue.quoted_gross_price;
    v_snapshot_fee_percent := v_queue.quoted_platform_fee_percent;
    v_snapshot_fee_amount := v_queue.quoted_platform_fee_amount;
    v_snapshot_net_amount := v_queue.quoted_professional_net_amount;
    v_snapshot_pricing_rule_id := v_queue.pricing_rule_id;
    v_snapshot_fee_rule_id := v_queue.fee_rule_id;
    v_snapshot_payment_status := trim(coalesce(v_queue.payment_status, ''));
    v_snapshot_current_payment_charge_id := v_queue.current_payment_charge_id;
    v_snapshot_paid_at := v_queue.paid_at;
  END IF;

  IF v_snapshot_service_code = '' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'QUEUE_PRICING_SNAPSHOT_REQUIRED',
      DETAIL = 'Queue acceptance requires a non-empty service_code snapshot.';
  END IF;

  IF v_snapshot_price_source <> 'platform_fixed' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'QUEUE_PRICE_SOURCE_INVALID',
      DETAIL = 'Queue-originated services must use a platform_fixed price source.';
  END IF;

  IF v_snapshot_gross_price IS NULL OR v_snapshot_gross_price <= 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'QUEUE_PRICE_SNAPSHOT_INVALID',
      DETAIL = 'Queue acceptance requires a gross price snapshot greater than zero.';
  END IF;

  IF v_snapshot_fee_percent IS NULL
    OR v_snapshot_fee_percent < 0
    OR v_snapshot_fee_percent > 1
    OR v_snapshot_fee_amount IS NULL
    OR v_snapshot_fee_amount < 0
    OR v_snapshot_net_amount IS NULL
    OR v_snapshot_net_amount < 0
    OR v_snapshot_pricing_rule_id IS NULL
    OR v_snapshot_fee_rule_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'QUEUE_FEE_SNAPSHOT_INVALID',
      DETAIL = 'Queue acceptance requires complete fee and net amount snapshots.';
  END IF;

  IF v_snapshot_payment_status = '' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'QUEUE_PAYMENT_STATUS_REQUIRED',
      DETAIL = 'Queue acceptance requires a payment_status snapshot.';
  END IF;

  SELECT
    p.id,
    p.user_id,
    p.full_name,
    p.specialty,
    p.status,
    p.is_on_duty
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

  SELECT
    pp.specialty,
    pp.is_on_duty,
    pp.status
  INTO
    v_public_profile_specialty,
    v_public_profile_is_on_duty,
    v_public_profile_status
  FROM public.professional_public_profiles AS pp
  WHERE trim(coalesce(pp.professional_profile_id, '')) = trim(v_professional.id::TEXT)
     OR trim(coalesce(pp.user_id, '')) = trim(p_professional_app_user_id)
  ORDER BY
    CASE
      WHEN trim(coalesce(pp.professional_profile_id, '')) = trim(v_professional.id::TEXT) THEN 0
      ELSE 1
    END,
    pp.updated_at DESC
  LIMIT 1;

  v_has_public_profile := FOUND;

  IF v_has_public_profile AND lower(trim(coalesce(v_public_profile_status, ''))) <> 'approved' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'PROFESSIONAL_PROFILE_NOT_ELIGIBLE',
      DETAIL = 'Professional public profile must be approved.';
  END IF;

  v_professional_specialty := CASE
    WHEN v_has_public_profile
      THEN coalesce(
        nullif(trim(coalesce(v_public_profile_specialty, '')), ''),
        nullif(trim(coalesce(v_professional.specialty, '')), ''),
        ''
      )
    ELSE coalesce(nullif(trim(coalesce(v_professional.specialty, '')), ''), '')
  END;
  v_professional_is_on_duty := CASE
    WHEN v_has_public_profile THEN coalesce(v_public_profile_is_on_duty, false)
    ELSE coalesce(v_professional.is_on_duty, false)
  END;
  v_professional_specialty_normalized := public.normalize_plantao_specialty(v_professional_specialty);
  v_queue_specialty_normalized := public.normalize_plantao_specialty(v_queue.specialty);

  IF NOT v_professional_is_on_duty THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'PROFESSIONAL_NOT_ON_DUTY',
      DETAIL = 'Professional must be on duty to accept queue entries.';
  END IF;

  IF v_professional_specialty_normalized = '' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'PROFESSIONAL_SPECIALTY_REQUIRED',
      DETAIL = 'Professional specialty is required.';
  END IF;

  IF v_professional_specialty_normalized NOT IN ('clinico_geral', 'pediatria', 'psicologia', 'psiquiatria') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'PROFESSIONAL_SPECIALTY_NOT_ELIGIBLE',
      DETAIL = 'Professional specialty cannot work on duty.';
  END IF;

  IF v_queue_specialty_normalized = '' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'QUEUE_SPECIALTY_REQUIRED',
      DETAIL = 'Queue specialty is required.';
  END IF;

  IF v_queue_specialty_normalized <> v_professional_specialty_normalized THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'QUEUE_SPECIALTY_MISMATCH',
      DETAIL = format(
        'Queue specialty %s does not match professional specialty %s.',
        coalesce(v_queue.specialty, '<null>'),
        v_professional_specialty
      );
  END IF;

  IF coalesce(nullif(trim(v_queue.status), ''), '') <> 'waiting' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'QUEUE_NOT_WAITING',
      DETAIL = format('Queue status is %s.', coalesce(v_queue.status, '<null>'));
  END IF;

  IF nullif(trim(coalesce(v_queue.assigned_professional_id, '')), '') IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'QUEUE_ALREADY_ASSIGNED',
      DETAIL = 'Queue entry is already assigned.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('queue|' || trim(v_queue.id::TEXT)));
  PERFORM pg_advisory_xact_lock(hashtext('queue-patient|' || trim(coalesce(v_queue.patient_id, ''))));
  PERFORM pg_advisory_xact_lock(hashtext('queue-professional|' || trim(v_professional.id::TEXT)));

  PERFORM 1
  FROM public.queues AS q
  WHERE q.id <> v_queue.id
    AND trim(coalesce(q.patient_id, '')) = trim(coalesce(v_queue.patient_id, ''))
    AND coalesce(nullif(trim(q.status), ''), '') IN ('assigned', 'in_progress', 'em_atendimento')
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'PATIENT_ALREADY_ASSIGNED',
      DETAIL = 'Patient already has another active queue assignment.';
  END IF;

  PERFORM 1
  FROM public.consultas AS c
  WHERE trim(coalesce(c.paciente_id, '')) = trim(coalesce(v_queue.patient_id, ''))
    AND trim(coalesce(c.tipo_consulta, '')) = 'plantao'
    AND coalesce(nullif(trim(c.status), ''), '') IN ('aguardando', 'em_atendimento')
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'PATIENT_ALREADY_IN_CONSULTA',
      DETAIL = 'Patient already has an active duty consultation.';
  END IF;

  PERFORM 1
  FROM public.queues AS q
  WHERE q.id <> v_queue.id
    AND trim(coalesce(q.assigned_professional_id, '')) = trim(v_professional.id::TEXT)
    AND coalesce(nullif(trim(q.status), ''), '') IN ('assigned', 'in_progress', 'em_atendimento')
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'PROFESSIONAL_ALREADY_ASSIGNED',
      DETAIL = 'Professional already has another active queue assignment.';
  END IF;

  PERFORM 1
  FROM public.consultas AS c
  WHERE (
      trim(coalesce(c.profissional_user_id, '')) = trim(p_professional_app_user_id)
      OR trim(coalesce(c.profissional_id, '')) = trim(v_professional.id::TEXT)
    )
    AND trim(coalesce(c.tipo_consulta, '')) = 'plantao'
    AND coalesce(nullif(trim(c.status), ''), '') IN ('aguardando', 'em_atendimento')
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'PROFESSIONAL_ALREADY_ASSIGNED',
      DETAIL = 'Professional already has an active duty consultation.';
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
    v_queue.patient_id,
    coalesce(v_queue.patient_name, ''),
    coalesce(v_queue.patient_email, ''),
    v_professional.id::TEXT,
    p_professional_app_user_id,
    coalesce(v_professional.full_name, ''),
    coalesce(v_queue.specialty, ''),
    'plantao',
    'aguardando',
    v_now_text,
    coalesce(v_queue.symptoms, ''),
    v_snapshot_service_code,
    v_snapshot_gross_price
  )
  RETURNING id INTO v_consulta_id;

  INSERT INTO public.appointments (
    patient_id,
    patient_name,
    patient_email,
    professional_id,
    professional_name,
    specialty,
    appointment_type,
    scheduled_datetime,
    date,
    time,
    status,
    price,
    service_code,
    price_source,
    gross_price,
    platform_fee_percent,
    platform_fee_amount,
    professional_net_amount,
    pricing_rule_id,
    fee_rule_id,
    pricing_estimated,
    payment_status,
    current_payment_charge_id,
    paid_at,
    symptoms,
    accepted_at,
    consulta_id
  ) VALUES (
    v_queue.patient_id,
    coalesce(v_queue.patient_name, ''),
    coalesce(v_queue.patient_email, ''),
    v_professional.id::TEXT,
    coalesce(v_professional.full_name, ''),
    coalesce(v_queue.specialty, ''),
    'IMEDIATO',
    v_now_text,
    v_appointment_date,
    v_appointment_time,
    'accepted',
    v_snapshot_gross_price,
    v_snapshot_service_code,
    v_snapshot_price_source,
    v_snapshot_gross_price,
    v_snapshot_fee_percent,
    v_snapshot_fee_amount,
    v_snapshot_net_amount,
    v_snapshot_pricing_rule_id,
    v_snapshot_fee_rule_id,
    false,
    v_snapshot_payment_status,
    v_snapshot_current_payment_charge_id,
    v_snapshot_paid_at,
    coalesce(v_queue.symptoms, ''),
    v_now_text,
    v_consulta_id::TEXT
  );

  UPDATE public.queues
  SET status = 'assigned',
      assigned_professional_id = v_professional.id::TEXT,
      estimated_wait_time = 0,
      service_code = v_snapshot_service_code,
      price_source = v_snapshot_price_source,
      quoted_gross_price = v_snapshot_gross_price,
      quoted_platform_fee_percent = v_snapshot_fee_percent,
      quoted_platform_fee_amount = v_snapshot_fee_amount,
      quoted_professional_net_amount = v_snapshot_net_amount,
      pricing_rule_id = v_snapshot_pricing_rule_id,
      fee_rule_id = v_snapshot_fee_rule_id,
      payment_status = v_snapshot_payment_status,
      current_payment_charge_id = v_snapshot_current_payment_charge_id,
      paid_at = v_snapshot_paid_at
  WHERE id = v_queue.id;

  RETURN QUERY
  SELECT
    v_queue.id,
    'assigned'::TEXT,
    v_professional.id::TEXT,
    v_queue.patient_id,
    coalesce(v_queue.patient_name, ''),
    coalesce(v_queue.specialty, ''),
    coalesce(v_queue.position, 0),
    0,
    coalesce(v_queue.solicitacao_exame_id, ''),
    v_consulta_id,
    'aguardando'::TEXT,
    'plantao'::TEXT,
    v_now_text,
    v_professional.id::TEXT,
    p_professional_app_user_id,
    coalesce(v_professional.full_name, '');
END;
$$;

COMMIT;
