import { AppError } from '../_shared/errors.ts';
import type { AcceptSolicitacaoExameInput } from './types.ts';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseAcceptSolicitacaoExameInput(body: unknown): AcceptSolicitacaoExameInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const solicitacaoId = String((body as Record<string, unknown>).solicitacaoId ?? '').trim();

  if (!solicitacaoId) {
    throw new AppError({
      status: 400,
      code: 'SOLICITACAO_ID_REQUIRED',
      message: '"solicitacaoId" is required.',
    });
  }

  if (!UUID_REGEX.test(solicitacaoId)) {
    throw new AppError({
      status: 400,
      code: 'SOLICITACAO_ID_INVALID',
      message: '"solicitacaoId" must be a valid UUID.',
    });
  }

  return { solicitacaoId };
}
