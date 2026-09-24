import type { SupabaseClient } from '../../../supabase.ts';
import { internalPlansError } from '../../contracts/errors.ts';
import type {
  ActivatePlanSubscriptionInput,
  AddFamilyPlanMemberInput,
  ConsumeInternalPlanCreditInput,
  FindAvailableSubscriptionScoreInput,
  ListSubscriptionScoresInput,
  UseSubscriptionScoreInput,
} from '../../contracts/types.ts';

export type InternalPlansJobRow = {
  id: string;
  job_type: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  max_attempts: number;
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export interface InternalPlansRepository {
  activate(input: ActivatePlanSubscriptionInput): Promise<Record<string, unknown>>;
  findAvailable(input: FindAvailableSubscriptionScoreInput): Promise<Record<string, unknown> | null>;
  useScore(input: UseSubscriptionScoreInput): Promise<Record<string, unknown>>;
  listScores(input: ListSubscriptionScoresInput): Promise<Record<string, unknown>>;
  addFamilyMember(input: AddFamilyPlanMemberInput): Promise<Record<string, unknown>>;
  consumePlanCredit(input: ConsumeInternalPlanCreditInput): Promise<Record<string, unknown>>;
  reconcilePlanCredit(input: {
    usageId: string;
    ownerType: 'appointment' | 'queue';
    ownerId: string;
    requestId: string;
  }): Promise<string>;
  refreshMonthly(period: string): Promise<Record<string, unknown>>;
  disableExpired(cutoff: string): Promise<Record<string, unknown>>;
  syncExternalAccess(subscriptionId: string): Promise<Record<string, unknown>>;
  enqueueJob(input: {
    jobType: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
    availableAt?: string;
    maxAttempts?: number;
  }): Promise<InternalPlansJobRow>;
  claimJobs(workerId: string, limit: number): Promise<InternalPlansJobRow[]>;
  completeJob(jobId: string, workerId: string, result: Record<string, unknown>): Promise<boolean>;
  failJob(jobId: string, workerId: string, code: string, message: string): Promise<string>;
  markActivationFailed(orderId: string, paymentChargeId: string, code: string, message: string): Promise<void>;
}

export class SupabaseInternalPlansRepository implements InternalPlansRepository {
  constructor(private readonly client: SupabaseClient) {}

  private async rpc(operation: string, name: string, params: Record<string, unknown>) {
    const { data, error } = await this.client.rpc(name, params);
    if (error) throw internalPlansError(operation, error);
    return data as unknown;
  }

  async activate(input: ActivatePlanSubscriptionInput) {
    return toRecord(await this.rpc('activation', 'activate_internal_plan_subscription', {
      p_plan_subscription_order_id: input.planSubscriptionOrderId,
      p_payment_charge_id: input.paymentChargeId,
      p_external_key: input.externalKey,
      p_paid_at: input.paidAt,
      p_customer: input.customer || {},
      p_metadata: input.metadata || {},
    }));
  }

  async findAvailable(input: FindAvailableSubscriptionScoreInput) {
    const value = await this.rpc('score lookup', 'find_available_internal_subscription_score', {
      p_external_key: input.externalKey,
      p_legacy_plan_id: input.legacyPlanId,
      p_legacy_specialization_id: input.legacySpecializationId,
    });
    return value ? toRecord(value) : null;
  }

  async useScore(input: UseSubscriptionScoreInput) {
    return toRecord(await this.rpc('score consumption', 'use_internal_subscription_score', {
      p_subscription_score_id: input.subscriptionScoreId,
    }));
  }

  async listScores(input: ListSubscriptionScoresInput) {
    return toRecord(await this.rpc('score listing', 'list_internal_subscription_scores', {
      p_external_key: input.externalKey,
      p_subscription_id: input.subscriptionId || null,
    }));
  }

  async addFamilyMember(input: AddFamilyPlanMemberInput) {
    return toRecord(await this.rpc('family member creation', 'add_internal_family_plan_member', {
      p_subscription_id: input.subscriptionId,
      p_holder_external_key: input.holderExternalKey,
      p_member_external_key: input.memberExternalKey,
    }));
  }

  async consumePlanCredit(input: ConsumeInternalPlanCreditInput) {
    return toRecord(await this.rpc('atomic credit consumption', 'consume_internal_plan_credit', {
      p_subscription_score_id: input.subscriptionScoreId,
      p_usage_id: input.usageId,
      p_owner_type: input.ownerType,
      p_owner_id: input.ownerId,
      p_request_snapshot: input.requestSnapshot || {},
      p_response_snapshot: input.responseSnapshot || {},
    }));
  }

  async reconcilePlanCredit(input: {
    usageId: string;
    ownerType: 'appointment' | 'queue';
    ownerId: string;
    requestId: string;
  }) {
    return String(await this.rpc('credit reconciliation', 'reconcile_internal_plan_credit_usage', {
      p_usage_id: input.usageId,
      p_owner_type: input.ownerType,
      p_owner_id: input.ownerId,
      p_request_id: input.requestId,
    }));
  }

  async refreshMonthly(period: string) {
    return toRecord(await this.rpc('monthly score refresh', 'refresh_internal_plan_subscription_scores', {
      p_period: period,
    }));
  }

  async disableExpired(cutoff: string) {
    return toRecord(await this.rpc('score expiration', 'disable_expired_internal_plan_subscription_scores', {
      p_cutoff: cutoff,
    }));
  }

  async syncExternalAccess(subscriptionId: string) {
    const result = await this.rpc('external access synchronization', 'sync_internal_plan_external_access', {
      p_subscription_id: subscriptionId,
    });
    return { status: String(result || '') };
  }

  async enqueueJob(input: {
    jobType: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
    availableAt?: string;
    maxAttempts?: number;
  }) {
    return toRecord(await this.rpc('job enqueue', 'enqueue_internal_plans_job', {
      p_job_type: input.jobType,
      p_idempotency_key: input.idempotencyKey,
      p_payload: input.payload,
      p_available_at: input.availableAt || new Date().toISOString(),
      p_max_attempts: input.maxAttempts || 5,
    })) as unknown as InternalPlansJobRow;
  }

  async claimJobs(workerId: string, limit: number) {
    const value = await this.rpc('job claim', 'claim_internal_plans_jobs', {
      p_worker_id: workerId,
      p_limit: limit,
      p_lock_seconds: 300,
    });
    return (Array.isArray(value) ? value : []) as InternalPlansJobRow[];
  }

  async completeJob(jobId: string, workerId: string, result: Record<string, unknown>) {
    return Boolean(await this.rpc('job completion', 'complete_internal_plans_job', {
      p_job_id: jobId,
      p_worker_id: workerId,
      p_result: result,
    }));
  }

  async failJob(jobId: string, workerId: string, code: string, message: string) {
    return String(await this.rpc('job failure', 'fail_internal_plans_job', {
      p_job_id: jobId,
      p_worker_id: workerId,
      p_error_code: code,
      p_error_message: message,
    }));
  }

  async markActivationFailed(orderId: string, paymentChargeId: string, code: string, message: string) {
    const { error } = await this.client
      .from('plan_subscription_orders')
      .update({ status: 'activation_failed', error_code: code, error_message: message })
      .eq('id', orderId)
      .eq('current_payment_charge_id', paymentChargeId)
      .neq('status', 'active');
    if (error) throw internalPlansError('activation failure persistence', error);
  }
}
