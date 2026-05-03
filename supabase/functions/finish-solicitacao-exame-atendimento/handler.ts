import { requireAuthenticatedUser } from '../_shared/auth.ts';
import {
  createRequestId,
  ensureMethod,
  errorResponse,
  handlePreflight,
  readJsonBody,
  successResponse,
} from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { createFinishSolicitacaoExameAtendimentoRuntime } from './repository.ts';
import { finishSolicitacaoExameAtendimento } from './service.ts';
import { parseFinishSolicitacaoExameAtendimentoInput } from './validation.ts';

const FUNCTION_NAME = 'finish-solicitacao-exame-atendimento';
const CORS: CorsOptions = {
  allowedMethods: ['POST'],
};

export async function handleFinishSolicitacaoExameAtendimentoRequest(req: Request) {
  const preflightResponse = handlePreflight(req, CORS);

  if (preflightResponse) {
    return preflightResponse;
  }

  const requestId = createRequestId();
  const methodErrorResponse = ensureMethod(req, {
    allowedMethods: ['POST'],
    functionName: FUNCTION_NAME,
    requestId,
    cors: CORS,
  });

  if (methodErrorResponse) {
    return methodErrorResponse;
  }

  try {
    const body = await readJsonBody<unknown>(req);
    const input = parseFinishSolicitacaoExameAtendimentoInput(body);
    const runtime = createFinishSolicitacaoExameAtendimentoRuntime();
    const authenticatedUser = await requireAuthenticatedUser(req, runtime.authUserLookup);
    const result = await finishSolicitacaoExameAtendimento({
      requestId,
      input,
      authenticatedUser,
      repository: runtime.repository,
    });

    return successResponse(result, requestId, {
      cors: CORS,
    });
  } catch (error) {
    return errorResponse(error, {
      requestId,
      functionName: FUNCTION_NAME,
      cors: CORS,
    });
  }
}
