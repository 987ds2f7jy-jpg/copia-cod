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
import { createSessionAccountServiceClient } from '../_shared/sessionAccount.ts';
import { requireConsultationAccess } from '../_shared/teleconsultaAccess.ts';

const FUNCTION_NAME = 'deepgram-token';
const CORS: CorsOptions = {
  allowedMethods: ['POST'],
};

function getDeepgramApiKey() {
  const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY')?.trim();

  if (!deepgramApiKey) {
    throw new AppError({
      status: 500,
      code: 'DEEPGRAM_NOT_CONFIGURED',
      message: 'Deepgram not configured.',
    });
  }

  return deepgramApiKey;
}

function normalizeConsultationId(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const consultationId = String((body as Record<string, unknown>).consultationId ?? '').trim();

  if (!consultationId) {
    throw new AppError({
      status: 400,
      code: 'CONSULTATION_ID_REQUIRED',
      message: '"consultationId" is required.',
    });
  }

  return consultationId;
}

async function handleDeepgramTokenRequest(req: Request) {
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
    const consultationId = normalizeConsultationId(await readJsonBody<unknown>(req));
    const client = createSessionAccountServiceClient();
    const { appUser } = await requireConsultationAccess({
      req,
      consultationId,
      client,
      allowedRoles: ['professional'],
    });

    const deepgramApiKey = getDeepgramApiKey();
    const validateResponse = await fetch('https://api.deepgram.com/v1/projects', {
      headers: {
        Authorization: `Token ${deepgramApiKey}`,
      },
    });

    if (!validateResponse.ok) {
      throw new AppError({
        status: 502,
        code: 'DEEPGRAM_KEY_INVALID',
        message: 'Invalid Deepgram API key.',
        details: {
          providerStatus: validateResponse.status,
        },
      });
    }

    console.info('[deepgram-token] request:success', {
      requestId,
      appUserId: appUser.id,
      consultationId,
    });

    return successResponse({
      key: deepgramApiKey,
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

Deno.serve(handleDeepgramTokenRequest);
