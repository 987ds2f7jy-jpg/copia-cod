import { AppError } from '../_shared/errors.ts';
import type { JoinQueueInput } from './types.ts';

export function parseJoinQueueInput(body: unknown): JoinQueueInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const specialty = String(record.specialty ?? '').trim();
  const symptoms = String(record.symptoms ?? '').trim();
  const priorityLevel = String(record.priorityLevel ?? 'normal').trim() || 'normal';
  const solicitacaoExameId = String(record.solicitacaoExameId ?? '').trim();

  if (!specialty) {
    throw new AppError({
      status: 400,
      code: 'SPECIALTY_REQUIRED',
      message: '"specialty" is required.',
    });
  }

  return {
    specialty,
    symptoms,
    priorityLevel,
    solicitacaoExameId,
  };
}
