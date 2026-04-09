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
import { createJoinQueueRuntime } from './repository.ts';
import { joinQueue } from './service.ts';
import { parseJoinQueueInput } from './validation.ts';

const FUNCTION_NAME = 'join-queue';
const CORS: CorsOptions = {
  allowedMethods: ['POST'],
};

export async function handleJoinQueueRequest(req: Request) {
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
    const input = parseJoinQueueInput(body);
    const runtime = createJoinQueueRuntime();
    const authenticatedUser = await requireAuthenticatedUser(req, runtime.authUserLookup);
    const result = await joinQueue({
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
