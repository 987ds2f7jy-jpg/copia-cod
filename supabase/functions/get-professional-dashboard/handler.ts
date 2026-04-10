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
import { createGetProfessionalDashboardRuntime } from './repository.ts';
import { getProfessionalDashboard } from './service.ts';
import { parseGetProfessionalDashboardInput } from './validation.ts';

const FUNCTION_NAME = 'get-professional-dashboard';
const CORS: CorsOptions = { allowedMethods: ['POST'] };

export async function handleGetProfessionalDashboardRequest(req: Request) {
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
    const input = parseGetProfessionalDashboardInput(body);
    const runtime = createGetProfessionalDashboardRuntime();
    const authenticatedUser = await requireAuthenticatedUser(req, runtime.authUserLookup);
    const appUser = await runtime.resolveAppUser(authenticatedUser.authUserId);
    const result = await getProfessionalDashboard({
      requestId,
      input,
      authenticatedUser,
      appUserId: appUser.id,
      repository: runtime.repository,
    });

    return successResponse(result, requestId, { status: 200, cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
}

