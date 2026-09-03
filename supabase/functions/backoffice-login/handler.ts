import { BACKOFFICE_CORS, handleBackofficePreflight } from '../_shared/backofficeCors.ts';
import { createRequestId, ensureMethod, errorResponse, readJsonBody, successResponse } from '../_shared/http.ts';
import { createBackofficeLoginRuntime } from './repository.ts';
import { loginBackofficeAdmin } from './service.ts';
import { parseBackofficeLoginInput } from './validation.ts';

const FUNCTION_NAME = 'backoffice-login';
const CORS = BACKOFFICE_CORS;

export async function handleBackofficeLoginRequest(req: Request) {
  const preflight = handleBackofficePreflight(req);
  if (preflight) return preflight;
  const requestId = createRequestId();
  const methodError = ensureMethod(req, { allowedMethods: ['POST'], functionName: FUNCTION_NAME, requestId, cors: CORS });
  if (methodError) return methodError;

  try {
    const input = parseBackofficeLoginInput(await readJsonBody(req));
    const runtime = createBackofficeLoginRuntime();
    const result = await loginBackofficeAdmin({ input, repository: runtime.repository });
    return successResponse(result, requestId, { cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
}
