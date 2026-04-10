import { AppError } from '../_shared/errors.ts';
import type { RequestWithdrawalInput } from './types.ts';

export function parseRequestWithdrawalInput(body: unknown): RequestWithdrawalInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const value = Number(record.value);
  const pixKey = String(record.pixKey ?? '').trim();

  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError({
      status: 422,
      code: 'WITHDRAWAL_VALUE_INVALID',
      message: 'Withdrawal value must be greater than zero.',
    });
  }

  return {
    value,
    pixKey: pixKey || null,
  };
}

