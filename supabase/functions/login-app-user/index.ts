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
  linkSessionAccountAuthUserId,
  loadSessionAccountByEmail,
  loadSessionAccountByAuthUserId,
  signInWithPassword,
} from '../_shared/sessionAccount.ts';

const FUNCTION_NAME = 'login-app-user';
const CORS: CorsOptions = {
  allowedMethods: ['POST'],
};
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function parseInput(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const email = normalizeString(record.email).toLowerCase();
  const password = normalizeString(record.password);

  if (!email || !EMAIL_REGEX.test(email)) {
    throw new AppError({
      status: 400,
      code: 'EMAIL_INVALID',
      message: '"email" must be a valid email address.',
    });
  }

  if (!password) {
    throw new AppError({
      status: 400,
      code: 'PASSWORD_REQUIRED',
      message: '"password" is required.',
    });
  }

  return { email, password };
}

async function handleLoginAppUserRequest(req: Request) {
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
    const authResult = await signInWithPassword(input);
    const client = createSessionAccountServiceClient();
    let appUser = await loadSessionAccountByAuthUserId(client, authResult.authUserId);

    if (!appUser?.id) {
      const appUserByEmail = await loadSessionAccountByEmail(client, authResult.email);

      if (appUserByEmail?.id) {
        if (appUserByEmail.authUserId && appUserByEmail.authUserId !== authResult.authUserId) {
          throw new AppError({
            status: 409,
            code: 'APP_USER_ALREADY_LINKED',
            message: 'This application profile is already linked to another auth user.',
          });
        }

        appUser = await linkSessionAccountAuthUserId(client, {
          appUserId: appUserByEmail.id,
          authUserId: authResult.authUserId,
        });

        console.info('[login-app-user] relinked-app-user-by-email', {
          requestId,
          appUserId: appUser.id,
          authUserId: authResult.authUserId,
          email: authResult.email,
        });
      }
    }

    appUser = assertActiveSessionAccount(appUser);

    console.info('[login-app-user] request:success', {
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

Deno.serve(handleLoginAppUserRequest);
