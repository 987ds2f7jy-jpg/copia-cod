BEGIN;

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
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_appointment_payment_guard ON public.appointments;
CREATE TRIGGER enforce_appointment_payment_guard
  BEFORE INSERT OR UPDATE OF status, payment_status, current_payment_charge_id, payment_required
  ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_appointment_payment_guard();


CREATE OR REPLACE FUNCTION public.enforce_queue_payment_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_status TEXT := lower(trim(coalesce(NEW.status, '')));
BEGIN
  IF coalesce(NEW.payment_required, true)
    AND v_status IN ('assigned', 'in_progress', 'em_atendimento')
  THEN
    IF trim(coalesce(NEW.payment_status, '')) <> 'paid' THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'QUEUE_PAYMENT_REQUIRED',
        DETAIL = 'Queue entry cannot become operational before payment is confirmed.';
    END IF;

    IF NEW.current_payment_charge_id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'QUEUE_PAYMENT_CHARGE_REQUIRED',
        DETAIL = 'Queue payment confirmation requires current_payment_charge_id.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_queue_payment_guard ON public.queues;
CREATE TRIGGER enforce_queue_payment_guard
  BEFORE INSERT OR UPDATE OF status, payment_status, current_payment_charge_id, payment_required
  ON public.queues
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_queue_payment_guard();


CREATE OR REPLACE FUNCTION public.enforce_solicitacao_exame_payment_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_status TEXT := lower(trim(coalesce(NEW.status, '')));
BEGIN
  IF coalesce(NEW.payment_required, true)
    AND v_status IN ('in_progress', 'completed')
  THEN
    IF trim(coalesce(NEW.payment_status, '')) <> 'paid' THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'SOLICITACAO_EXAME_PAYMENT_REQUIRED',
        DETAIL = 'Exam/service request cannot become operational before payment is confirmed.';
    END IF;

    IF NEW.current_payment_charge_id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'SOLICITACAO_EXAME_PAYMENT_CHARGE_REQUIRED',
        DETAIL = 'Exam/service request payment confirmation requires current_payment_charge_id.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_solicitacao_exame_payment_guard ON public.solicitacoes_exames;
CREATE TRIGGER enforce_solicitacao_exame_payment_guard
  BEFORE INSERT OR UPDATE OF status, payment_status, current_payment_charge_id, payment_required
  ON public.solicitacoes_exames
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_solicitacao_exame_payment_guard();

COMMIT;
