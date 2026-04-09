import { AppError } from '../_shared/errors.ts';
import type { DeleteSolicitacaoExameInput } from './types.ts';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseDeleteSolicitacaoExameInput(body: unknown): DeleteSolicitacaoExameInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const solicitacaoId = String(record.solicitacaoId ?? '').trim();

  if (!UUID_REGEX.test(solicitacaoId)) {
    throw new AppError({
      status: 400,
      code: 'SOLICITACAO_ID_INVALID',
      message: '"solicitacaoId" must be a valid UUID.',
    });
  }

  return {
    solicitacaoId,
  };
}
