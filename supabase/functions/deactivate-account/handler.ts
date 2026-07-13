import { getBearerToken, requireAuthenticatedUser } from '../_shared/auth.ts';
import {
  createRequestId,
  ensureMethod,
  errorResponse,
  handlePreflight,
  readJsonBody,
  successResponse,
} from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { createDeactivateAccountRuntime } from './repository.ts';
import { deactivateAccount } from './service.ts';
import { parseDeactivateAccountInput } from './validation.ts';

const FUNCTION_NAME = 'deactivate-account';
const CORS: CorsOptions = {
  allowedMethods: ['POST'],
};

export async function handleDeactivateAccountRequest(req: Request) {
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
    const input = parseDeactivateAccountInput(body);
    const runtime = createDeactivateAccountRuntime();
    const accessToken = getBearerToken(req);
    const authenticatedUser = await requireAuthenticatedUser(req, runtime.authUserLookup);
    const result = await deactivateAccount({
      requestId,
      authenticatedUser,
      accessToken,
      input,
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
