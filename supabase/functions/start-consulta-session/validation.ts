import { AppError } from '../_shared/errors.ts';
import type { StartConsultaSessionInput } from './types.ts';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseStartConsultaSessionInput(body: unknown): StartConsultaSessionInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const consultationId = String(record.consultationId ?? '').trim();

  if (!UUID_REGEX.test(consultationId)) {
    throw new AppError({
      status: 400,
      code: 'CONSULTATION_ID_INVALID',
      message: '"consultationId" must be a valid UUID.',
    });
  }

  return {
    consultationId,
  };
}
