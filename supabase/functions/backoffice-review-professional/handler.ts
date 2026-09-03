import { createRequestId, ensureMethod, errorResponse, handlePreflight, readJsonBody, successResponse } from '../_shared/http.ts';
import { createBackofficeReviewProfessionalRuntime } from './repository.ts';
import { reviewBackofficeProfessional } from './service.ts';
import { parseBackofficeReviewProfessionalInput } from './validation.ts';

const FUNCTION_NAME = 'backoffice-review-professional';
const CORS = { allowedMethods: ['POST'] };

export async function handleBackofficeReviewProfessionalRequest(req: Request) {
  const preflight = handlePreflight(req, CORS);
  if (preflight) return preflight;
  const requestId = createRequestId();
  const methodError = ensureMethod(req, { allowedMethods: ['POST'], functionName: FUNCTION_NAME, requestId, cors: CORS });
  if (methodError) return methodError;
  try {
    const input = parseBackofficeReviewProfessionalInput(await readJsonBody(req));
    const runtime = createBackofficeReviewProfessionalRuntime();
    const result = await reviewBackofficeProfessional({ req, client: runtime.client, repository: runtime.repository, input });
    return successResponse(result, requestId, { cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
}
