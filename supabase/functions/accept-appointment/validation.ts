import { AppError } from '../_shared/errors.ts';
import type { AcceptAppointmentInput } from './types.ts';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseAcceptAppointmentInput(body: unknown): AcceptAppointmentInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const appointmentId = String((body as Record<string, unknown>).appointmentId ?? '').trim();

  if (!appointmentId) {
    throw new AppError({
      status: 400,
      code: 'APPOINTMENT_ID_REQUIRED',
      message: '"appointmentId" is required.',
    });
  }

  if (!UUID_REGEX.test(appointmentId)) {
    throw new AppError({
      status: 400,
      code: 'APPOINTMENT_ID_INVALID',
      message: '"appointmentId" must be a valid UUID.',
    });
  }

  return { appointmentId };
}
