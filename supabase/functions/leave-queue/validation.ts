import { AppError } from '../_shared/errors.ts';
import type { LeaveQueueInput } from './types.ts';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseLeaveQueueInput(body: unknown): LeaveQueueInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const queueIdRaw = String((body as Record<string, unknown>).queueId ?? '').trim();
  const queueId = queueIdRaw || null;

  if (queueId && !UUID_REGEX.test(queueId)) {
    throw new AppError({
      status: 400,
      code: 'QUEUE_ID_INVALID',
      message: '"queueId" must be a valid UUID.',
    });
  }

  return { queueId };
}
