import { AppError } from '../_shared/errors.ts';

export function parsePendingProfessionalsInput(body: unknown) {
  const record = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const requestedLimit = Number(record.limit ?? 100);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 200) {
    throw new AppError({ status: 422, code: 'LIMIT_INVALID', message: 'Limit must be an integer between 1 and 200.' });
  }
  return { limit: requestedLimit };
}
