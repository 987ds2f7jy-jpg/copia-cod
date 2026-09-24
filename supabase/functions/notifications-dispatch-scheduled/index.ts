import { AppError } from '../_shared/errors.ts';
import {
  createRequestId,
  ensureMethod,
  errorResponse,
  handlePreflight,
  readJsonBody,
  successResponse,
} from '../_shared/http.ts';
import { createAppointmentReminderRuntime } from './repository.ts';
import {
  dispatchDailyAppointmentReminders,
  getSaoPauloDate,
} from './service.ts';
import { parseScheduledNotificationsInput } from './validation.ts';

const FUNCTION_NAME = 'notifications-dispatch-scheduled';
const CORS = { allowedMethods: ['POST'] };

function getRequiredSchedulerSecret() {
  const secret = Deno.env.get('NOTIFICATIONS_SCHEDULER_SECRET')?.trim() || '';

  if (!secret) {
    throw new AppError({
      status: 503,
      code: 'NOTIFICATIONS_SCHEDULER_NOT_CONFIGURED',
      message: 'Notifications scheduler is not configured.',
    });
  }

  return secret;
}

async function requireSchedulerAuthorization(req: Request) {
  const expected = new TextEncoder().encode(getRequiredSchedulerSecret());
  const received = new TextEncoder().encode(
    req.headers.get('x-notifications-scheduler-secret')?.trim() || '',
  );
  const [expectedDigest, receivedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', expected),
    crypto.subtle.digest('SHA-256', received),
  ]);
  const expectedHash = new Uint8Array(expectedDigest);
  const receivedHash = new Uint8Array(receivedDigest);
  let mismatch = expectedHash.length !== receivedHash.length;

  for (let index = 0; index < expectedHash.length; index += 1) {
    mismatch = mismatch || expectedHash[index] !== receivedHash[index];
  }

  if (mismatch) {
    throw new AppError({
      status: 401,
      code: 'NOTIFICATIONS_SCHEDULER_UNAUTHORIZED',
      message: 'Scheduler authorization is required.',
    });
  }
}

export async function handleScheduledNotificationsRequest(req: Request) {
  const preflightResponse = handlePreflight(req, CORS);
  if (preflightResponse) return preflightResponse;

  const requestId = createRequestId();
  const methodError = ensureMethod(req, {
    allowedMethods: ['POST'],
    functionName: FUNCTION_NAME,
    requestId,
    cors: CORS,
  });
  if (methodError) return methodError;

  try {
    await requireSchedulerAuthorization(req);
    const input = parseScheduledNotificationsInput(await readJsonBody<unknown>(req));
    const runtime = createAppointmentReminderRuntime();
    const date = input.date || getSaoPauloDate();
    const summary = await dispatchDailyAppointmentReminders({
      date,
      executionId: requestId,
      repository: runtime.repository,
      notificationService: runtime.notificationService,
    });

    console.info('[notifications-dispatch-scheduled] batch:completed', {
      requestId,
      ...summary,
    });

    return successResponse(summary, requestId, { cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
}

Deno.serve(handleScheduledNotificationsRequest);
