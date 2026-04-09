import { getBearerToken } from '../_shared/auth.ts';
import {
  createRequestId,
  ensureMethod,
  errorResponse,
  handlePreflight,
  readJsonBody,
  successResponse,
} from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { createBootstrapAppUserRuntime } from './repository.ts';
import { bootstrapAppUser } from './service.ts';
import { parseBootstrapAppUserInput } from './validation.ts';

const FUNCTION_NAME = 'bootstrap-app-user';
const CORS: CorsOptions = {
  allowedMethods: ['POST'],
};

export async function handleBootstrapAppUserRequest(req: Request) {
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
    const input = parseBootstrapAppUserInput(body);
    const runtime = createBootstrapAppUserRuntime();
    const hasAuthorizationHeader = Boolean(req.headers.get('Authorization'));
    const authenticatedUser = hasAuthorizationHeader
      ? await runtime.authUserLookup(getBearerToken(req))
      : null;
    const result = await bootstrapAppUser({
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
