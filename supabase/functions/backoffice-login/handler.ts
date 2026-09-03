import { createRequestId, ensureMethod, errorResponse, handlePreflight, readJsonBody, successResponse } from '../_shared/http.ts';
import { createBackofficeLoginRuntime } from './repository.ts';
import { loginBackofficeAdmin } from './service.ts';
import { parseBackofficeLoginInput } from './validation.ts';

const FUNCTION_NAME = 'backoffice-login';
const CORS = { allowedMethods: ['POST'] };

export async function handleBackofficeLoginRequest(req: Request) {
  const preflight = handlePreflight(req, CORS);
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
