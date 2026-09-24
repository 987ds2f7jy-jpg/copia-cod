import { AppError } from '../errors.ts';
import { logTechnicalEvent } from '../observability.ts';
import type { SupabaseClient } from '../supabase.ts';
import { getPlansFacade } from './facade.ts';

type PlanCreditOwnerType = 'appointment' | 'queue';

export async function consumePlanCreditOnce({
  client,
  ownerType,
  ownerId,
  usageId,
  internalSubscriptionScoreId,
}: {
  client: SupabaseClient;
  ownerType: PlanCreditOwnerType;
  ownerId: string;
  usageId: string;
  internalSubscriptionScoreId: string;
}) {
  const scoreId = String(internalSubscriptionScoreId || '').trim();
  if (!scoreId) {
    throw new AppError({
      status: 422,
      code: 'PLAN_CREDIT_SUBSCRIPTION_SCORE_ID_REQUIRED',
      message: 'Plan credit audit is missing the internal subscription score id required for consumption.',
      details: { ownerType, ownerId, usageId },
    });
  }

  logTechnicalEvent('info', {
    functionName: 'plan-credit', operation: 'plan_credit.consume', resourceType: ownerType,
    resourceId: ownerId, status: 'started', provider: 'internal',
  });

  const result = await getPlansFacade(client).consumePlanCredit({
    subscriptionScoreId: scoreId,
    usageId,
    ownerType,
    ownerId,
    requestSnapshot: { provider: 'internal', subscription_score_id: scoreId },
    responseSnapshot: { provider: 'internal', confirmed: true },
  });
  const outcome = String(result.outcome || 'used_now') as 'used_now' | 'already_used';

  logTechnicalEvent('info', {
    functionName: 'plan-credit', operation: 'plan_credit.consume', resourceType: ownerType,
    resourceId: ownerId, status: outcome, provider: 'internal',
  });

  return { skipped: outcome === 'already_used', reason: outcome };
}
