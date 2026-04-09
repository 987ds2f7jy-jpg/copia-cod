import { AppError } from '../_shared/errors.ts';
import type { CancelAppointmentInput } from './types.ts';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseCancelAppointmentInput(body: unknown): CancelAppointmentInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const appointmentId = String(record.appointmentId ?? '').trim();
  const reason = String(record.reason ?? '').trim();

  if (!UUID_REGEX.test(appointmentId)) {
    throw new AppError({
      status: 400,
      code: 'APPOINTMENT_ID_INVALID',
      message: '"appointmentId" must be a valid UUID.',
    });
  }

  if (reason.length > 1000) {
    throw new AppError({
      status: 422,
      code: 'CANCELLATION_REASON_TOO_LONG',
      message: '"reason" must be at most 1000 characters.',
    });
  }

  return {
    appointmentId,
    reason,
  };
}
