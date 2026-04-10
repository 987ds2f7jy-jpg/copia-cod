import { AppError } from '../_shared/errors.ts';
import type { SetProfessionalDutyInput } from './types.ts';

export function parseSetProfessionalDutyInput(body: unknown): SetProfessionalDutyInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const isOnDuty = Boolean(record.isOnDuty);

  return { isOnDuty };
}

