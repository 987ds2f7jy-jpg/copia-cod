import { logTechnicalEvent } from '../_shared/observability.ts';
import type {
  ReconciliationQueueCommand,
  ReconciliationQueueRepository,
} from './types.ts';

export async function getReconciliationQueue({
  requestId,
  input,
  admin,
  repository,
}: ReconciliationQueueCommand & { repository: ReconciliationQueueRepository }) {
  const startedAt = Date.now();
  const { rows, total } = await repository.list(input);
  await repository.writeAccessAudit({ admin, requestId });

  logTechnicalEvent('info', {
    functionName: 'get-reconciliation-queue',
    requestId,
    operation: 'reconciliation_queue.list',
    actorId: admin.id,
    actorRole: admin.role,
    status: 'succeeded',
    durationMs: Date.now() - startedAt,
  });

  return {
    items: rows.map((row) => ({
      type: row.issue_type,
      severity: row.severity,
      ownerType: row.owner_type,
      ownerId: row.owner_id,
      status: row.status,
      resourceStatus: row.resource_status,
      reasonCode: row.reason_code,
      detectedAt: row.source_updated_at,
      paymentChargeId: row.payment_charge_id,
      planCreditUsageId: row.plan_credit_usage_id,
      provider: row.provider,
    })),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.ceil(total / input.pageSize),
    },
  };
}
