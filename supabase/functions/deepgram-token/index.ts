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
import { requireTranscriptionConsent } from '../_shared/consultation-consent.ts';

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
    const { appUser, consultation } = await requireConsultationAccess({
      req,
      consultationId,
      client,
      allowedRoles: ['professional'],
    });

    if (String(consultation.status || '').toLowerCase() !== 'em_atendimento') {
      throw new AppError({
        status: 409,
        code: 'CONSULTATION_NOT_ACTIVE',
        message: 'Transcription is available only during an active consultation.',
      });
    }

    await requireTranscriptionConsent(client, {
      consultationId,
      patientUserId: consultation.paciente_id,
    });

    const deepgramApiKey = getDeepgramApiKey();
    const grantResponse = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: {
        Authorization: `Token ${deepgramApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl_seconds: 30 }),
    });

    if (!grantResponse.ok) {
      throw new AppError({
        status: 502,
        code: 'DEEPGRAM_TOKEN_GRANT_FAILED',
        message: 'Unable to obtain a temporary Deepgram token.',
        details: {
          providerStatus: grantResponse.status,
        },
      });
    }

    const grant = await grantResponse.json().catch(() => null);
    const accessToken = String(grant?.access_token || '').trim();
    const expiresIn = Number(grant?.expires_in || 0);

    if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new AppError({
        status: 502,
        code: 'DEEPGRAM_TOKEN_GRANT_INVALID',
        message: 'Deepgram returned an invalid temporary token.',
      });
    }

    console.info('[deepgram-token] request:success', {
      requestId,
      appUserId: appUser.id,
      consultationId,
    });

    return successResponse({
      accessToken,
      expiresIn,
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
