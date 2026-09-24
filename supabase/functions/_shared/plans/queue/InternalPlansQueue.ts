import type { ActivatePlanSubscriptionInput, ConsumeInternalPlanCreditInput } from '../contracts/types.ts';
import type { InternalPlansRepository } from '../internal/repositories/InternalPlansRepository.ts';

export class InternalPlansQueue {
  constructor(private readonly repository: InternalPlansRepository) {}

  enqueueActivation(input: ActivatePlanSubscriptionInput, retry = false) {
    return this.repository.enqueueJob({
      jobType: retry ? 'retry_plan_activation' : 'activate_plan_subscription',
      idempotencyKey: retry
        ? `plan-activation-retry:${input.paymentChargeId}`
        : `plan-activation:${input.paymentChargeId}`,
      payload: input,
    });
  }

  enqueueMonthlyRefresh(period: string) {
    return this.repository.enqueueJob({
      jobType: 'refresh_monthly_subscription_scores',
      idempotencyKey: `plan-score-refresh:${period}`,
      payload: { period },
    });
  }

  enqueueExpiration(cutoff: string, executionDate: string) {
    return this.repository.enqueueJob({
      jobType: 'disable_expired_subscription_scores',
      idempotencyKey: `plan-score-expiration:${executionDate}`,
      payload: { cutoff },
    });
  }

  enqueueReconciliation(input: ConsumeInternalPlanCreditInput) {
    return this.repository.enqueueJob({
      jobType: 'reconcile_plan_credit',
      idempotencyKey: `plan-credit-reconcile:${input.usageId}`,
      payload: input,
    });
  }

  enqueueExternalAccessSync(subscriptionId: string, statusVersion: string) {
    return this.repository.enqueueJob({
      jobType: 'sync_external_access',
      idempotencyKey: `plan-external-access:${subscriptionId}:${statusVersion}`,
      payload: { subscriptionId },
    });
  }
}
