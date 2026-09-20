import { BACKOFFICE_CORS, handleBackofficePreflight } from '../_shared/backofficeCors.ts';
import { createRequestId, ensureMethod, errorResponse, readJsonBody, successResponse } from '../_shared/http.ts';
import { createBackofficeServicesListRuntime } from './repository.ts';
import { listBackofficeServices } from './service.ts';
import { parseBackofficeServicesListInput } from './validation.ts';

const FUNCTION_NAME = 'backoffice-services-list';
const CORS = BACKOFFICE_CORS;

export async function handleBackofficeServicesListRequest(req: Request) {
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
    parseBackofficeServicesListInput(await readJsonBody(req));
    const runtime = createBackofficeServicesListRuntime();
    const result = await listBackofficeServices({
      req,
      client: runtime.client,
      repository: runtime.repository,
    });
    return successResponse(result, requestId, { cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
}
