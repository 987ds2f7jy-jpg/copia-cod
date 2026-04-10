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
import { createSetProfessionalDutyRuntime } from './repository.ts';
import { setProfessionalDuty } from './service.ts';
import { parseSetProfessionalDutyInput } from './validation.ts';

const FUNCTION_NAME = 'set-professional-duty';
const CORS: CorsOptions = { allowedMethods: ['POST'] };

export async function handleSetProfessionalDutyRequest(req: Request) {
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
    const input = parseSetProfessionalDutyInput(body);
    const runtime = createSetProfessionalDutyRuntime();
    const authenticatedUser = await requireAuthenticatedUser(req, runtime.authUserLookup);
    const appUser = await runtime.resolveAppUser(authenticatedUser.authUserId);
    const result = await setProfessionalDuty({
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

