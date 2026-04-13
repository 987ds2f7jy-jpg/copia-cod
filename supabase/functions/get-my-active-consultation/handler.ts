import { requireAuthenticatedUser } from '../_shared/auth.ts';
import { isAppError } from '../_shared/errors.ts';
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

function buildEmptyActiveConsultationResult() {
  return {
    hasActiveConsultation: false,
    consultation: null,
    participantRole: null,
    resumeUrl: null,
    roomReady: false,
    needsProfessionalStart: false,
    counterpartName: null,
  };
}

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
    if (
      (isAppError(error) && [
        'AUTH_REQUIRED',
        'AUTH_TOKEN_INVALID',
        'AUTH_USER_INVALID',
      ].includes(error.code)) ||
      (error instanceof Error && String(error.message || '').trim().toLowerCase() === 'invalid jwt')
    ) {
      return successResponse(buildEmptyActiveConsultationResult(), requestId, {
        status: 200,
        cors: CORS,
      });
    }

    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
}
