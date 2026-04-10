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
import { createReviewProfessionalApplicationRuntime } from './repository.ts';
import { reviewProfessionalApplication } from './service.ts';
import { parseReviewProfessionalApplicationInput } from './validation.ts';

const FUNCTION_NAME = 'review-professional-application';
const CORS: CorsOptions = { allowedMethods: ['POST'] };

export async function handleReviewProfessionalApplicationRequest(req: Request) {
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
    const body = await readJsonBody<unknown>(req);
    const input = parseReviewProfessionalApplicationInput(body);
    const runtime = createReviewProfessionalApplicationRuntime();
    const authenticatedUser = await requireAuthenticatedUser(req, runtime.authUserLookup);
    await runtime.resolveAdmin(authenticatedUser.authUserId);
    const result = await reviewProfessionalApplication({
      requestId,
      input,
      authenticatedUser,
      repository: runtime.repository,
    });

    return successResponse(result, requestId, { status: 200, cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
}

