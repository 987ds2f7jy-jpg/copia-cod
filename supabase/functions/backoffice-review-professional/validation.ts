import { AppError } from '../_shared/errors.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseBackofficeReviewProfessionalInput(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({ status: 400, code: 'INVALID_BODY', message: 'Request body must be an object.' });
  }
  const record = body as Record<string, unknown>;
  const professionalProfileId = String(record.professionalProfileId ?? '').trim();
  const action = String(record.action ?? '').trim();
  const reason = String(record.reason ?? '').trim();

  if (!UUID_REGEX.test(professionalProfileId)) {
    throw new AppError({ status: 422, code: 'PROFESSIONAL_PROFILE_ID_INVALID', message: 'professionalProfileId must be a valid UUID.' });
  }
  if (action !== 'approve' && action !== 'reject') {
    throw new AppError({ status: 422, code: 'BACKOFFICE_ACTION_INVALID', message: 'action must be approve or reject.' });
  }
  if (reason.length > 500) {
    throw new AppError({ status: 422, code: 'REVIEW_REASON_INVALID', message: 'reason must have at most 500 characters.' });
  }
  return { professionalProfileId, action: action as 'approve' | 'reject', reason: reason || null };
}
