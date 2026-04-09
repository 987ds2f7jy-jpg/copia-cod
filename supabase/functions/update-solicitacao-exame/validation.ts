import { AppError } from '../_shared/errors.ts';
import type { UpdateSolicitacaoExameInput } from './types.ts';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_STATUS = new Set(['pending', 'in_progress', 'completed']);

function asTrimmedString(value: unknown) {
  return String(value ?? '').trim();
}

export function parseUpdateSolicitacaoExameInput(body: unknown): UpdateSolicitacaoExameInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const solicitacaoId = asTrimmedString(record.solicitacaoId);
  const queueId = asTrimmedString(record.queueId);
  const statusRaw = asTrimmedString(record.status);
  const medicoId = asTrimmedString(record.medicoId);

  if (!UUID_REGEX.test(solicitacaoId)) {
    throw new AppError({
      status: 400,
      code: 'SOLICITACAO_ID_INVALID',
      message: '"solicitacaoId" must be a valid UUID.',
    });
  }

  if (statusRaw && !VALID_STATUS.has(statusRaw)) {
    throw new AppError({
      status: 400,
      code: 'STATUS_INVALID',
      message: '"status" must be pending, in_progress or completed.',
    });
  }

  if (!queueId && !statusRaw && !medicoId) {
    throw new AppError({
      status: 400,
      code: 'EMPTY_UPDATE',
      message: 'At least one updatable field must be informed.',
    });
  }

  return {
    solicitacaoId,
    queueId,
    status: (statusRaw || '') as UpdateSolicitacaoExameInput['status'],
    medicoId,
  };
}
