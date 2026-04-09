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
import { createUpdateMyProfileRuntime } from './repository.ts';
import { updateMyProfile } from './service.ts';
import { parseUpdateMyProfileInput } from './validation.ts';

const FUNCTION_NAME = 'update-my-profile';
const CORS: CorsOptions = {
  allowedMethods: ['POST'],
};

export async function handleUpdateMyProfileRequest(req: Request) {
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
    const input = parseUpdateMyProfileInput(body);
    const runtime = createUpdateMyProfileRuntime();
    const authenticatedUser = await requireAuthenticatedUser(req, runtime.authUserLookup);
    const result = await updateMyProfile({
      requestId,
      authenticatedUser,
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
