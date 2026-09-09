import { BACKOFFICE_CORS, handleBackofficePreflight } from '../_shared/backofficeCors.ts';
import { createRequestId, ensureMethod, errorResponse, readJsonBody, successResponse } from '../_shared/http.ts';
import { createPendingProfessionalsRuntime } from './repository.ts';
import { listPendingProfessionals } from './service.ts';
import { parsePendingProfessionalsInput } from './validation.ts';

const FUNCTION_NAME = 'backoffice-pending-professionals';
const CORS = BACKOFFICE_CORS;

export async function handleBackofficePendingProfessionalsRequest(req: Request) {
  const preflight = handleBackofficePreflight(req);
  if (preflight) return preflight;
  const requestId = createRequestId();
  const methodError = ensureMethod(req, { allowedMethods: ['POST'], functionName: FUNCTION_NAME, requestId, cors: CORS });
  if (methodError) return methodError;
  try {
    const input = parsePendingProfessionalsInput(await readJsonBody(req));
    const runtime = createPendingProfessionalsRuntime();
    const result = await listPendingProfessionals({ req, client: runtime.client, repository: runtime.repository, ...input });
    return successResponse(result, requestId, { cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
}
