import { requireAuthenticatedUser } from '../_shared/auth.ts';
import {
  createRequestId,
  ensureMethod,
  errorResponse,
  handlePreflight,
  successResponse,
} from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { createGetMyActiveConsultationRuntime } from './repository.ts';
import { getMyActiveConsultation } from './service.ts';

const FUNCTION_NAME = 'get-my-active-consultation';
const CORS: CorsOptions = { allowedMethods: ['POST'] };

export async function handleGetMyActiveConsultationRequest(req: Request) {
  const preflightResponse = handlePreflight(req, CORS);
  if (preflightResponse) return preflightResponse;

  const requestId = createRequestId();
  const methodErrorResponse = ensureMethod(req, {
    allowedMethods: ['POST'],
    functionName: FUNCTION_NAME,
    requestId,
    cors: CORS,
  });
  if (methodErrorResponse) return methodErrorResponse;

  try {
    const runtime = createGetMyActiveConsultationRuntime();
    const authenticatedUser = await requireAuthenticatedUser(req, runtime.authUserLookup);
    const appUser = await runtime.resolveAppUser(authenticatedUser.authUserId);
    const result = await getMyActiveConsultation({
      requestId,
      appUser,
      repository: runtime.repository,
    });

    return successResponse(result, requestId, { status: 200, cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
}
