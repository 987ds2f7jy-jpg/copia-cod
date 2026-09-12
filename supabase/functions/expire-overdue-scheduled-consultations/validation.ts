import { AppError } from '../_shared/errors.ts';
import type { ExpirationWorkerInput } from './types.ts';

export function parseExpirationWorkerInput(body: unknown): ExpirationWorkerInput {
  if (body == null) {
    return { dryRun: false, limit: 100 };
  }

  if (typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({ status: 400, code: 'INVALID_BODY', message: 'Request body must be an object.' });
  }

  const record = body as Record<string, unknown>;
  const limit = Number(record.limit ?? 100);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new AppError({ status: 400, code: 'EXPIRATION_BATCH_LIMIT_INVALID', message: 'limit must be an integer between 1 and 500.' });
  }

  return { dryRun: record.dryRun === true, limit };
}
