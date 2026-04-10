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
import { createRequestWithdrawalRuntime } from './repository.ts';
import { requestWithdrawal } from './service.ts';
import { parseRequestWithdrawalInput } from './validation.ts';

const FUNCTION_NAME = 'request-withdrawal';
const CORS: CorsOptions = { allowedMethods: ['POST'] };

export async function handleRequestWithdrawalRequest(req: Request) {
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
    const input = parseRequestWithdrawalInput(body);
    const runtime = createRequestWithdrawalRuntime();
    const authenticatedUser = await requireAuthenticatedUser(req, runtime.authUserLookup);
    const appUser = await runtime.resolveAppUser(authenticatedUser.authUserId);
    const result = await requestWithdrawal({
      requestId,
      input,
      authenticatedUser,
      appUserId: appUser.id,
      repository: runtime.repository,
    });

    return successResponse(result, requestId, { status: 201, cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
}

