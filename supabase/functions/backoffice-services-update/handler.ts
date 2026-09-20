import { BACKOFFICE_CORS, handleBackofficePreflight } from '../_shared/backofficeCors.ts';
import { createRequestId, ensureMethod, errorResponse, readJsonBody, successResponse } from '../_shared/http.ts';
import { createBackofficeServicesUpdateRuntime } from './repository.ts';
import { updateBackofficeService } from './service.ts';
import { parseBackofficeServicesUpdateInput } from './validation.ts';

const FUNCTION_NAME = 'backoffice-services-update';
const CORS = BACKOFFICE_CORS;

export async function handleBackofficeServicesUpdateRequest(req: Request) {
  const preflight = handleBackofficePreflight(req);
  if (preflight) return preflight;

  const requestId = createRequestId();
  const methodError = ensureMethod(req, {
    allowedMethods: ['POST'],
    functionName: FUNCTION_NAME,
    requestId,
    cors: CORS,
  });
  if (methodError) return methodError;

  try {
    const input = parseBackofficeServicesUpdateInput(await readJsonBody(req));
    const runtime = createBackofficeServicesUpdateRuntime();
    const result = await updateBackofficeService({
      req,
      client: runtime.client,
      repository: runtime.repository,
      input,
      requestId,
    });
    return successResponse(result, requestId, { cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
}
