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
import { createGetSolicitacaoExameAtendimentoRuntime } from './repository.ts';
import { getSolicitacaoExameAtendimento } from './service.ts';
import { parseGetSolicitacaoExameAtendimentoInput } from './validation.ts';

const FUNCTION_NAME = 'get-solicitacao-exame-atendimento';
const CORS: CorsOptions = {
  allowedMethods: ['POST'],
};

export async function handleGetSolicitacaoExameAtendimentoRequest(req: Request) {
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
    const input = parseGetSolicitacaoExameAtendimentoInput(body);
    const runtime = createGetSolicitacaoExameAtendimentoRuntime();
    const authenticatedUser = await requireAuthenticatedUser(req, runtime.authUserLookup);
    const result = await getSolicitacaoExameAtendimento({
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
