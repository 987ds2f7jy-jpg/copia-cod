import { AppError } from '../_shared/errors.ts';
import type { DeactivateAccountInput } from './types.ts';

export function parseDeactivateAccountInput(body: unknown): DeactivateAccountInput {
  if (typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const confirmation = String((body as Record<string, unknown>).confirmation ?? '').trim();
  if (confirmation !== 'DEACTIVATE_MY_ACCOUNT') {
    throw new AppError({
      status: 422,
      code: 'ACCOUNT_DEACTIVATION_CONFIRMATION_REQUIRED',
      message: 'Explicit account deactivation confirmation is required.',
    });
  }

  return { confirmation: 'DEACTIVATE_MY_ACCOUNT' };
}
