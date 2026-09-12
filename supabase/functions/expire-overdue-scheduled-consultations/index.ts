import { AppError } from '../_shared/errors.ts';
import {
  createRequestId,
  ensureMethod,
  errorResponse,
  handlePreflight,
  readJsonBody,
  successResponse,
} from '../_shared/http.ts';
import { logTechnicalEvent } from '../_shared/observability.ts';
import { createExpirationWorkerRepository } from './repository.ts';
import { parseExpirationWorkerInput } from './validation.ts';

const FUNCTION_NAME = 'expire-overdue-scheduled-consultations';
const CORS = { allowedMethods: ['POST'] };

function getRequiredWorkerSecret() {
  const secret = Deno.env.get('SCHEDULED_CONSULTATION_EXPIRATION_WORKER_SECRET')?.trim() || '';
  if (!secret) {
    throw new AppError({ status: 503, code: 'SCHEDULED_EXPIRATION_WORKER_NOT_CONFIGURED', message: 'Scheduled expiration worker is not configured.' });
  }
  return secret;
}

async function requireWorkerAuthorization(req: Request) {
  const expected = getRequiredWorkerSecret();
  const received = req.headers.get('x-scheduled-consultation-worker-secret')?.trim() || '';
  const expectedBytes = new TextEncoder().encode(expected);
  const receivedBytes = new TextEncoder().encode(received);

  const [expectedDigest, receivedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', expectedBytes),
    crypto.subtle.digest('SHA-256', receivedBytes),
  ]);
  const expectedHash = new Uint8Array(expectedDigest);
  const receivedHash = new Uint8Array(receivedDigest);
  let mismatch = expectedHash.length !== receivedHash.length;
  for (let index = 0; index < expectedHash.length; index += 1) {
    mismatch = mismatch || expectedHash[index] !== receivedHash[index];
  }

  if (mismatch) {
    throw new AppError({ status: 401, code: 'SCHEDULED_EXPIRATION_WORKER_UNAUTHORIZED', message: 'Worker authorization is required.' });
  }
}

function getRolloutCutoff() {
  const value = Deno.env.get('SCHEDULED_CONSULTATION_EXPIRATION_ROLLOUT_CUTOFF')?.trim() || '';
  if (!value || !Number.isFinite(Date.parse(value))) {
    throw new AppError({ status: 503, code: 'SCHEDULED_EXPIRATION_ROLLOUT_CUTOFF_REQUIRED', message: 'Scheduled expiration rollout cutoff is not configured.' });
  }
  return new Date(value).toISOString();
}

function assertPersistentExpirationActivated() {
  if (Deno.env.get('SCHEDULED_CONSULTATION_EXPIRATION_ENABLED') !== 'true') {
    throw new AppError({ status: 409, code: 'SCHEDULED_EXPIRATION_DISABLED', message: 'Persistent scheduled consultation expiration is disabled.' });
  }
  if (Deno.env.get('SCHEDULED_CONSULTATION_FINANCIAL_POLICY_APPROVED') !== 'true') {
    throw new AppError({ status: 409, code: 'SCHEDULED_EXPIRATION_FINANCIAL_POLICY_PENDING', message: 'Persistent scheduled consultation expiration requires financial-policy approval.' });
  }
}

export async function handleExpirationWorkerRequest(req: Request) {
  const preflightResponse = handlePreflight(req, CORS);
  if (preflightResponse) return preflightResponse;

  const requestId = createRequestId();
  const methodError = ensureMethod(req, { allowedMethods: ['POST'], functionName: FUNCTION_NAME, requestId, cors: CORS });
  if (methodError) return methodError;

  try {
    await requireWorkerAuthorization(req);
    const input = parseExpirationWorkerInput(await readJsonBody<unknown>(req));
    const repository = createExpirationWorkerRepository();
    const rolloutCutoff = input.dryRun
      ? (Deno.env.get('SCHEDULED_CONSULTATION_EXPIRATION_ROLLOUT_CUTOFF')?.trim() || null)
      : getRolloutCutoff();

    if (input.dryRun) {
      const records = await repository.dryRun({ limit: input.limit, rolloutCutoff });
      const counts = records.reduce<Record<string, number>>((summary, record) => {
        summary[record.classification] = (summary[record.classification] || 0) + 1;
        return summary;
      }, {});
      return successResponse({ dryRun: true, counts, records }, requestId, { cors: CORS });
    }

    assertPersistentExpirationActivated();
    const result = await repository.expire({ limit: input.limit, rolloutCutoff });
    logTechnicalEvent('info', {
      functionName: FUNCTION_NAME,
      requestId,
      operation: 'scheduled_consultation.expire_batch',
      actorRole: 'system',
      resourceType: 'consulta',
      status: 'succeeded',
      retryCount: 0,
    });
    return successResponse({ dryRun: false, rolloutCutoff, ...result }, requestId, { cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
}

Deno.serve(handleExpirationWorkerRequest);
