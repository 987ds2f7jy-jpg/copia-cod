import { AppError } from '../_shared/errors.ts';
import type { FinishSolicitacaoExameAtendimentoInput } from './types.ts';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RECOMENDACOES_LENGTH = 8000;

export function parseFinishSolicitacaoExameAtendimentoInput(
  body: unknown,
): FinishSolicitacaoExameAtendimentoInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const solicitacaoId = String(record.solicitacaoId ?? '').trim();
  const recomendacoes = String(record.recomendacoes ?? record.plano ?? '').trim();

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

  if (!recomendacoes) {
    throw new AppError({
      status: 400,
      code: 'RECOMENDACOES_REQUIRED',
      message: '"recomendacoes" is required.',
    });
  }

  if (recomendacoes.length > MAX_RECOMENDACOES_LENGTH) {
    throw new AppError({
      status: 400,
      code: 'RECOMENDACOES_TOO_LONG',
      message: '"recomendacoes" is too long.',
      details: {
        maxLength: MAX_RECOMENDACOES_LENGTH,
      },
    });
  }

  return {
    solicitacaoId,
    recomendacoes,
  };
}
