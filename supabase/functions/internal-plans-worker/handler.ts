import { createRequestId, errorResponse, successResponse } from '../_shared/http.ts';
import { InternalNotificationService } from '../_shared/notifications/InternalNotificationService.ts';
import { notifyInternalBestEffort } from '../_shared/notifications/notify-best-effort.ts';
import { InternalPlansQueue } from '../_shared/plans/queue/InternalPlansQueue.ts';
import { InternalPlansJobProcessor } from '../_shared/plans/queue/InternalPlansJobProcessor.ts';
import {
  SupabaseInternalPlansRepository,
} from '../_shared/plans/internal/repositories/InternalPlansRepository.ts';
import { createServiceRoleClient, getRequiredEnv } from '../_shared/supabase.ts';

function isAuthorized(req: Request) {
  return req.headers.get('Authorization') === `Bearer ${getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')}`;
}

function utcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthStart(date: Date) {
  return `${date.toISOString().slice(0, 7)}-01`;
}

async function notifyActivationOutcome(
  client: ReturnType<typeof createServiceRoleClient>,
  job: { payload: Record<string, unknown> },
  requestId: string,
  succeeded: boolean,
) {
  const orderId = String(job.payload.planSubscriptionOrderId || '').trim();
  if (!orderId) return;
  const { data } = await client.from('plan_subscription_orders')
    .select('id, app_user_id, patient_id').eq('id', orderId).maybeSingle();
  const recipientUserId = String(data?.app_user_id || data?.patient_id || '').trim();
  if (!recipientUserId) return;
  await notifyInternalBestEffort({
    notificationService: new InternalNotificationService(client),
    functionName: 'internal-plans-worker',
    requestId,
    input: {
      recipientUserId,
      typeKey: succeeded ? 'plan.activated' : 'plan.activation_failed',
      relatedEntityType: 'plan',
      relatedEntityId: orderId,
      deduplicationKey: `plan_order:${orderId}:${succeeded ? 'activated' : 'activation_failed'}:${recipientUserId}`,
    },
  });
}

export async function handleInternalPlansWorkerRequest(req: Request) {
  const requestId = createRequestId();

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405 });
    }
    if (!isAuthorized(req)) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const client = createServiceRoleClient();
    const repository = new SupabaseInternalPlansRepository(client);
    const queue = new InternalPlansQueue(repository);
    const now = new Date();

    if (body.enqueueMaintenance === true) {
      await queue.enqueueMonthlyRefresh(monthStart(now));
      const cutoff = new Date(now);
      cutoff.setUTCMonth(cutoff.getUTCMonth() - 1);
      await queue.enqueueExpiration(cutoff.toISOString(), utcDate(now));
    }

    const workerId = `internal-plans-worker:${requestId}`;
    const processor = new InternalPlansJobProcessor(repository, workerId, {
      onActivationSucceeded: (job) => notifyActivationOutcome(client, job, requestId, true),
      onActivationFailed: (job) => notifyActivationOutcome(client, job, requestId, false),
    });
    const requestedLimit = Number(body.limit || 10);
    const result = await processor.processBatch(
      Number.isInteger(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 50)) : 10,
    );

    return successResponse(result, requestId);
  } catch (error) {
    return errorResponse(error, { requestId, functionName: 'internal-plans-worker' });
  }
}
