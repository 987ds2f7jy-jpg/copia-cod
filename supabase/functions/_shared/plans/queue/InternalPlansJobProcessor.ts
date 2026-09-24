import { sanitizeErrorCode, logTechnicalEvent } from '../../observability.ts';
import type { ActivatePlanSubscriptionInput, ConsumeInternalPlanCreditInput } from '../contracts/types.ts';
import { InternalPlansProvider } from '../internal/InternalPlansProvider.ts';
import type {
  InternalPlansJobRow,
  InternalPlansRepository,
} from '../internal/repositories/InternalPlansRepository.ts';
import { ExternalAccessService } from '../internal/services/ExternalAccessService.ts';
import { PlanCreditService } from '../internal/services/PlanCreditService.ts';

function text(value: unknown) { return String(value ?? '').trim(); }
function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export class InternalPlansJobProcessor {
  private readonly provider: InternalPlansProvider;
  private readonly planCredits: PlanCreditService;
  private readonly externalAccess: ExternalAccessService;

  constructor(
    private readonly repository: InternalPlansRepository,
    private readonly workerId: string,
    private readonly hooks: {
      onActivationSucceeded?: (job: InternalPlansJobRow, result: Record<string, unknown>) => Promise<void>;
      onActivationFailed?: (job: InternalPlansJobRow, code: string) => Promise<void>;
    } = {},
  ) {
    this.provider = new InternalPlansProvider(repository);
    this.planCredits = new PlanCreditService(repository);
    this.externalAccess = new ExternalAccessService(repository);
  }

  async processBatch(limit = 10) {
    const jobs = await this.repository.claimJobs(this.workerId, limit);
    const summary = { claimed: jobs.length, succeeded: 0, retried: 0, deadLetter: 0 };

    for (const job of jobs) {
      const payload = record(job.payload);
      try {
        const result = await this.execute(job);
        const completed = await this.repository.completeJob(job.id, this.workerId, result);
        if (completed) summary.succeeded += 1;
        if (
          completed
          && (job.job_type === 'activate_plan_subscription' || job.job_type === 'retry_plan_activation')
        ) {
          await this.hooks.onActivationSucceeded?.(job, result);
        }
        logTechnicalEvent('info', {
          functionName: 'internal-plans-worker',
          operation: job.job_type,
          resourceType: 'internal_plans_job',
          resourceId: job.id,
          status: 'succeeded',
          retryCount: job.attempts - 1,
          provider: 'internal',
        });
      } catch (error) {
        const code = sanitizeErrorCode(error);
        const next = await this.repository.failJob(
          job.id,
          this.workerId,
          code,
          error instanceof Error ? error.message : 'Internal Plans job failed.',
        );
        if (
          next === 'dead_letter'
          && (job.job_type === 'activate_plan_subscription' || job.job_type === 'retry_plan_activation')
        ) {
          await this.repository.markActivationFailed(
            text(payload.planSubscriptionOrderId),
            text(payload.paymentChargeId),
            code,
            error instanceof Error ? error.message : 'Internal Plans activation failed.',
          );
          await this.hooks.onActivationFailed?.(job, code);
        }
        if (next === 'dead_letter') summary.deadLetter += 1;
        else summary.retried += 1;
        logTechnicalEvent(next === 'dead_letter' ? 'error' : 'warn', {
          functionName: 'internal-plans-worker',
          operation: job.job_type,
          resourceType: 'internal_plans_job',
          resourceId: job.id,
          status: next,
          errorCode: code,
          retryCount: job.attempts,
          provider: 'internal',
        });
      }
    }

    return summary;
  }

  private async execute(job: InternalPlansJobRow): Promise<Record<string, unknown>> {
    const payload = record(job.payload);

    switch (job.job_type) {
      case 'activate_plan_subscription':
      case 'retry_plan_activation':
        return await this.provider.activatePlanSubscription(
          payload as unknown as ActivatePlanSubscriptionInput,
        ) as unknown as Record<string, unknown>;
      case 'refresh_monthly_subscription_scores':
        return this.repository.refreshMonthly(text(payload.period));
      case 'disable_expired_subscription_scores':
        return this.repository.disableExpired(text(payload.cutoff));
      case 'reconcile_plan_credit':
        return this.planCredits.consumeAtomically(payload as unknown as ConsumeInternalPlanCreditInput);
      case 'sync_external_access':
        return this.externalAccess.syncNutritionAccess(text(payload.subscriptionId));
      default:
        throw new Error(`Unsupported Internal Plans job type: ${job.job_type}`);
    }
  }
}
