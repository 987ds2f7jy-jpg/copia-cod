import { requireAuthenticatedUser } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import {
  createRequestId,
  ensureMethod,
  errorResponse,
  handlePreflight,
  readJsonBody,
  successResponse,
} from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { createUpsertOfficeLocationRuntime } from './repository.ts';
import { upsertOfficeLocation } from './service.ts';
import { parseOfficeLocationInput } from './validation.ts';

const FUNCTION_NAME = 'upsert-office-location';
const CORS: CorsOptions = {
  allowedMethods: ['POST'],
};

export async function handleUpsertOfficeLocationRequest(req: Request) {
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
    const input = parseOfficeLocationInput(body);
    const runtime = createUpsertOfficeLocationRuntime();
    const isGet = (input.action || 'upsert') === 'get';
    const authenticatedUser = isGet
      ? { authUserId: '', email: null }
      : await requireAuthenticatedUser(req, runtime.authUserLookup);
    const appUser = isGet
      ? { id: '', role: 'anonymous' }
      : await runtime.resolveAppUser(authenticatedUser.authUserId);
    const result = await upsertOfficeLocation({
      requestId,
      input,
      authenticatedUser,
      appUser,
      repository: runtime.repository,
    });

    return successResponse(result, requestId, {
      status: 200,
      cors: CORS,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error, {
        requestId,
        functionName: FUNCTION_NAME,
        cors: CORS,
      });
    }

    return errorResponse(error, {
      requestId,
      functionName: FUNCTION_NAME,
      cors: CORS,
    });
  }
}

