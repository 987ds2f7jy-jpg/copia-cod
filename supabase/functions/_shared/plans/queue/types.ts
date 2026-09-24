import type {
  ActivatePlanSubscriptionInput,
  ConsumeInternalPlanCreditInput,
} from '../contracts/types.ts';

export type InternalPlansJobType =
  | 'activate_plan_subscription'
  | 'retry_plan_activation'
  | 'refresh_monthly_subscription_scores'
  | 'disable_expired_subscription_scores'
  | 'reconcile_plan_credit'
  | 'sync_external_access';

export type InternalPlansJobPayload =
  | ({ jobType: 'activate_plan_subscription' | 'retry_plan_activation' } & ActivatePlanSubscriptionInput)
  | { jobType: 'refresh_monthly_subscription_scores'; period: string }
  | { jobType: 'disable_expired_subscription_scores'; cutoff: string }
  | ({ jobType: 'reconcile_plan_credit' } & ConsumeInternalPlanCreditInput)
  | { jobType: 'sync_external_access'; subscriptionId: string };

