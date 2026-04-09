import { AppError } from '../_shared/errors.ts';
import type { SubmitAppointmentReviewInput } from './types.ts';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseSubmitAppointmentReviewInput(body: unknown): SubmitAppointmentReviewInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const appointmentId = String(record.appointmentId ?? '').trim();
  const rating = Number(record.rating ?? 0);
  const comment = String(record.comment ?? '').trim();

  if (!UUID_REGEX.test(appointmentId)) {
    throw new AppError({
      status: 400,
      code: 'APPOINTMENT_ID_INVALID',
      message: '"appointmentId" must be a valid UUID.',
    });
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new AppError({
      status: 422,
      code: 'RATING_INVALID',
      message: '"rating" must be an integer between 1 and 5.',
    });
  }

  if (comment.length > 2000) {
    throw new AppError({
      status: 422,
      code: 'REVIEW_COMMENT_TOO_LONG',
      message: '"comment" must be at most 2000 characters.',
    });
  }

  return {
    appointmentId,
    rating,
    comment,
  };
}
