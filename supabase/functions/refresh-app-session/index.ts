import {
  createRequestId,
  ensureMethod,
  errorResponse,
  handlePreflight,
  readJsonBody,
  successResponse,
} from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { AppError } from '../_shared/errors.ts';
import {
  assertActiveSessionAccount,
  createSessionAccountServiceClient,
  loadSessionAccountByAuthUserId,
  refreshAuthSession,
} from '../_shared/sessionAccount.ts';

const FUNCTION_NAME = 'refresh-app-session';
const CORS: CorsOptions = {
  allowedMethods: ['POST'],
};

function parseInput(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const refreshToken = String((body as Record<string, unknown>).refreshToken ?? '').trim();

  if (!refreshToken) {
    throw new AppError({
      status: 400,
      code: 'REFRESH_TOKEN_REQUIRED',
      message: '"refreshToken" is required.',
    });
  }

  return { refreshToken };
}

async function handleRefreshAppSessionRequest(req: Request) {
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
    const input = parseInput(await readJsonBody<unknown>(req));
    const authResult = await refreshAuthSession(input.refreshToken);
    const client = createSessionAccountServiceClient();
    const appUser = assertActiveSessionAccount(
      await loadSessionAccountByAuthUserId(client, authResult.authUserId),
    );

    console.info('[refresh-app-session] request:success', {
      requestId,
      appUserId: appUser.id,
      authUserId: authResult.authUserId,
      role: appUser.role,
    });

    return successResponse({
      appUser,
      session: authResult.session,
    }, requestId, {
      status: 200,
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

Deno.serve(handleRefreshAppSessionRequest);
