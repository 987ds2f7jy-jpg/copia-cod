BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS appointments_active_professional_schedule_unique
  ON public.appointments (professional_id, scheduled_datetime)
  WHERE professional_id IS NOT NULL
    AND scheduled_datetime IS NOT NULL
    AND status IN (
      'SOLICITADO',
      'requested',
      'pending',
      'CONFIRMADO',
      'confirmed',
      'accepted',
      'in_progress',
      'em_atendimento'
    );

CREATE OR REPLACE FUNCTION public.enforce_appointment_payment_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_status TEXT := lower(trim(coalesce(NEW.status, '')));
BEGIN
  IF coalesce(NEW.payment_required, true)
    AND v_status IN ('accepted', 'in_progress', 'em_atendimento')
  THEN
    IF trim(coalesce(NEW.payment_status, '')) <> 'paid' THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'APPOINTMENT_PAYMENT_REQUIRED',
        DETAIL = 'Appointment cannot become operational before payment is confirmed.';
    END IF;

    IF NEW.current_payment_charge_id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'APPOINTMENT_PAYMENT_CHARGE_REQUIRED',
        DETAIL = 'Appointment payment confirmation requires current_payment_charge_id.';
    END IF;

    PERFORM 1
    FROM public.payment_charges AS pc
    WHERE pc.id = NEW.current_payment_charge_id
      AND pc.owner_type = 'appointment'
      AND pc.owner_id = NEW.id
      AND pc.status = 'paid';

    IF NOT FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'APPOINTMENT_PAYMENT_CHARGE_NOT_PAID',
        DETAIL = 'The current appointment charge is not a paid charge for this appointment.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
