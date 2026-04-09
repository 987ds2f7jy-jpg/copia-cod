import { AppError } from '../_shared/errors.ts';
import type { DeactivateAccountInput } from './types.ts';

export function parseDeactivateAccountInput(body: unknown): DeactivateAccountInput {
  if (body == null) {
    return {};
  }

  if (typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  return {};
}
