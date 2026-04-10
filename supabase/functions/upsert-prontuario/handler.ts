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
import { createUpsertProntuarioRuntime } from './repository.ts';
import { upsertProntuario } from './service.ts';
import { parseUpsertProntuarioInput } from './validation.ts';

const FUNCTION_NAME = 'upsert-prontuario';
const CORS: CorsOptions = {
  allowedMethods: ['POST'],
};

export async function handleUpsertProntuarioRequest(req: Request) {
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
    const input = parseUpsertProntuarioInput(body);
    const runtime = createUpsertProntuarioRuntime();
    const authenticatedUser = await requireAuthenticatedUser(req, runtime.authUserLookup);
    const result = await upsertProntuario({
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
