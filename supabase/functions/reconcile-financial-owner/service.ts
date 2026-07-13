import { AppError } from '../_shared/errors.ts';
import {
  logTechnicalEvent,
  sanitizeErrorCode,
} from '../_shared/observability.ts';
import type {
  ReconcileFinancialOwnerCommand,
  ReconcileFinancialOwnerRepository,
} from './types.ts';

const PAYMENT_ISSUES = new Set([
  'payment_paid_owner_not_released',
  'multiple_active_payment_charges',
  'paid_charge_owner_missing',
  'webhook_processing_stalled',
]);

const CREDIT_ISSUES = new Set([
  'plan_reconciliation_required',
  'plan_credit_usage_stalled',
  'plan_used_without_used_usage',
]);

function normalized(value: unknown) {
  return String(value ?? '').trim();
}

export function resolveExternalCreditStatus(
  subscriptions: Array<{ scores?: Array<Record<string, unknown>> | null }>,
  externalScoreId: string,
) {
  for (const subscription of subscriptions) {
    for (const score of subscription.scores || []) {
      if (normalized(score.subscription_score_id) !== externalScoreId) continue;
      return normalized(score.status_label).toLowerCase() || normalized(score.status).toLowerCase();
    }
  }
  return '';
}

export async function reconcileFinancialOwner({
  requestId,
  input,
  admin,
  repository,
}: ReconcileFinancialOwnerCommand & { repository: ReconcileFinancialOwnerRepository }) {
  const startedAt = Date.now();
  const claim = await repository.acquireClaim({
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    requestId,
    actorUserId: admin.id,
  });

  if (!claim) {
    throw new AppError({
      status: 409,
      code: 'RECONCILIATION_ALREADY_IN_PROGRESS',
      message: 'This resource is already being reconciled.',
    });
  }

  let initialIssueType = '';

  try {
    const before = await repository.listIssues(input.ownerType, input.ownerId);
    initialIssueType = before[0]?.issue_type || '';

    await repository.writeAudit({
      admin, requestId, ownerType: input.ownerType, ownerId: input.ownerId,
      outcome: 'started', issueType: initialIssueType || 'already_consistent',
    });

    if (before.length === 0) {
      await repository.writeAudit({
        admin, requestId, ownerType: input.ownerType, ownerId: input.ownerId,
        outcome: 'resolved', issueType: 'already_consistent',
      });
      return {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        status: 'already_consistent',
        payment: { attempted: false, changed: false, status: 'skipped', reasonCode: 'NOT_REQUIRED' },
        planCredit: { attempted: false, changed: false, status: 'skipped', reasonCode: 'NOT_REQUIRED' },
        remainingIssues: [],
      };
    }

    const payment = before.some((issue) => PAYMENT_ISSUES.has(issue.issue_type))
      ? await repository.reconcilePayment(input.ownerType, input.ownerId)
      : { attempted: false, changed: false, status: 'skipped' as const, reasonCode: 'NOT_REQUIRED' };
    const planCredit = before.some((issue) => CREDIT_ISSUES.has(issue.issue_type))
      ? await repository.reconcilePlanCredit(input.ownerType, input.ownerId, requestId)
      : { attempted: false, changed: false, status: 'skipped' as const, reasonCode: 'NOT_REQUIRED' };
    const after = await repository.listIssues(input.ownerType, input.ownerId);
    const resolved = after.length === 0;
    const outcome = resolved ? 'resolved' : 'manual_review_required';

    await repository.writeAudit({
      admin, requestId, ownerType: input.ownerType, ownerId: input.ownerId,
      outcome, issueType: after[0]?.issue_type || initialIssueType,
      errorCode: resolved ? null : after[0]?.reason_code || 'MANUAL_REVIEW_REQUIRED',
    });

    logTechnicalEvent(resolved ? 'info' : 'warn', {
      functionName: 'reconcile-financial-owner',
      requestId,
      operation: 'financial_owner.reconcile',
      actorId: admin.id,
      actorRole: admin.role,
      resourceType: input.ownerType,
      resourceId: input.ownerId,
      status: outcome,
      errorCode: resolved ? null : after[0]?.reason_code,
      durationMs: Date.now() - startedAt,
    });

    return {
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      status: outcome,
      payment,
      planCredit,
      remainingIssues: after.map((issue) => ({
        type: issue.issue_type,
        reasonCode: issue.reason_code,
      })),
    };
  } catch (error) {
    const errorCode = sanitizeErrorCode(error);
    await repository.writeAudit({
      admin, requestId, ownerType: input.ownerType, ownerId: input.ownerId,
      outcome: 'failed', errorCode, issueType: initialIssueType || 'reconciliation_failed',
    });
    logTechnicalEvent('error', {
      functionName: 'reconcile-financial-owner',
      requestId,
      operation: 'financial_owner.reconcile',
      actorId: admin.id,
      actorRole: admin.role,
      resourceType: input.ownerType,
      resourceId: input.ownerId,
      status: 'failed',
      errorCode,
      durationMs: Date.now() - startedAt,
    });
    throw error;
  } finally {
    await repository.releaseClaim({
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      requestId,
    });
  }
}
