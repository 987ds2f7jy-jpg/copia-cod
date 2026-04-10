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
import { createStartConsultaSessionRuntime } from './repository.ts';
import { startConsultaSession } from './service.ts';
import { parseStartConsultaSessionInput } from './validation.ts';

const FUNCTION_NAME = 'start-consulta-session';
const CORS: CorsOptions = {
  allowedMethods: ['POST'],
};

export async function handleStartConsultaSessionRequest(req: Request) {
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
    const input = parseStartConsultaSessionInput(body);
    const runtime = createStartConsultaSessionRuntime();
    const authenticatedUser = await requireAuthenticatedUser(req, runtime.authUserLookup);
    const result = await startConsultaSession({
      requestId,
      input,
      authenticatedUser,
      repository: runtime.repository,
    });

    return successResponse(result, requestId, {
      status: 200,
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
