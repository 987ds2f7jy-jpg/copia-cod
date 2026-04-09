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
import { createCreateAppointmentRuntime } from './repository.ts';
import { createAppointment } from './service.ts';
import { parseCreateAppointmentInput } from './validation.ts';

const FUNCTION_NAME = 'create-appointment';
const CORS: CorsOptions = {
  allowedMethods: ['POST'],
};

export async function handleCreateAppointmentRequest(req: Request) {
  const preflightResponse = handlePreflight(req, CORS);

  if (preflightResponse) {
    return preflightResponse;
  }

  const requestId = createRequestId();
  const methodErrorResponse = ensureMethod(req, {
    allowedMethods: ['POST'],
    functionName: FUNCTION_NAME,
    requestId,
    cors: CORS,
  });

  if (methodErrorResponse) {
    return methodErrorResponse;
  }

  try {
    const body = await readJsonBody<unknown>(req);
    const input = parseCreateAppointmentInput(body);
    const runtime = createCreateAppointmentRuntime();
    const authenticatedUser = await requireAuthenticatedUser(req, runtime.authUserLookup);
    const result = await createAppointment({
      requestId,
      input,
      authenticatedUser,
      repository: runtime.repository,
    });

    return successResponse(result, requestId, {
      status: 201,
      cors: CORS,
    });
  } catch (error) {
    return errorResponse(error, {
      requestId,
      functionName: FUNCTION_NAME,
      cors: CORS,
    });
  }
}
