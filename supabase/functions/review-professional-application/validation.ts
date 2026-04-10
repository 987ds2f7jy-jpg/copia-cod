import { AppError } from '../_shared/errors.ts';
import type { ReviewProfessionalApplicationInput } from './types.ts';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseReviewProfessionalApplicationInput(body: unknown): ReviewProfessionalApplicationInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const publicProfileId = String(record.publicProfileId ?? '').trim();
  const action = String(record.action ?? '').trim();

  if (!UUID_REGEX.test(publicProfileId)) {
    throw new AppError({
      status: 400,
      code: 'PUBLIC_PROFILE_ID_INVALID',
      message: '"publicProfileId" must be a valid UUID.',
    });
  }

  if (!['approve', 'reject', 'suspend'].includes(action)) {
    throw new AppError({
      status: 422,
      code: 'ACTION_INVALID',
      message: '"action" must be one of: approve, reject, suspend.',
    });
  }

  return {
    publicProfileId,
    action: action as 'approve' | 'reject' | 'suspend',
  };
}

