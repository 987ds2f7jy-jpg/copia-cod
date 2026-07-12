import { AppError } from '../_shared/errors.ts';
import type { GetPaymentStatusInput } from './types.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseGetPaymentStatusInput(body: unknown): GetPaymentStatusInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const chargeId = String((body as Record<string, unknown>).chargeId ?? '').trim();

  if (!UUID_REGEX.test(chargeId)) {
    throw new AppError({
      status: 400,
      code: 'PAYMENT_CHARGE_ID_INVALID',
      message: '"chargeId" must be a valid UUID.',
    });
  }

  return { chargeId };
}
