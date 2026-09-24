import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { PlansProvider } from '../../supabase/functions/_shared/plans/contracts/PlansProvider';
import { InternalPlansProvider } from '../../supabase/functions/_shared/plans/internal/InternalPlansProvider';
import type { InternalPlansRepository } from '../../supabase/functions/_shared/plans/internal/repositories/InternalPlansRepository';
import { INTERNAL_PLAN_RULES } from '../../supabase/functions/_shared/plans/domain/plan-rules';
import { resolveScoreAllocations } from '../../supabase/functions/_shared/plans/domain/score-allocation';
import { findPlanSpecialization } from '../../supabase/functions/_shared/plans/domain/specialization-map';
import { InternalPlansQueue } from '../../supabase/functions/_shared/plans/queue/InternalPlansQueue';
import { InternalPlansJobProcessor } from '../../supabase/functions/_shared/plans/queue/InternalPlansJobProcessor';

const root = process.cwd();
const domainMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260924090000_create_internal_plans_domain.sql'),
  'utf8',
);
const jobsMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260924091000_create_internal_plans_jobs.sql'),
  'utf8',
);

function createRepository(overrides: Partial<InternalPlansRepository> = {}): InternalPlansRepository {
  return {
    activate: vi.fn().mockResolvedValue({
      backend: 'internal', created: true, activation_id: 'activation-1', plan_code: 'psychology',
      legacy_plan_id: 1, subscription_id: 'subscription-1', external_key: 'patient@example.com',
      raw_status: 1, status: 'active', payment_verified_at: '2026-09-24T10:00:00Z',
      activated_at: '2026-09-24T10:00:01Z',
    }),
    findAvailable: vi.fn().mockResolvedValue(null),
    useScore: vi.fn().mockResolvedValue({
      backend: 'internal', outcome: 'used_now', subscription_id: 'subscription-1',
      subscription_score_id: 'credit-1', score_id: 'score-1', raw_status: 2,
      status: 'used', used_at: '2026-09-24T11:00:00Z',
    }),
    listScores: vi.fn().mockResolvedValue({ backend: 'internal', external_key: 'patient@example.com', subscriptions: [] }),
    addFamilyMember: vi.fn().mockResolvedValue({
      backend: 'internal', member_id: 'member-1', subscription_id: 'subscription-1',
      holder_external_key: 'holder@example.com', member_external_key: 'member@example.com',
      created_at: '2026-09-24T10:00:00Z',
    }),
    consumePlanCredit: vi.fn().mockResolvedValue({ outcome: 'used_now' }),
    reconcilePlanCredit: vi.fn().mockResolvedValue('reconciled'),
    refreshMonthly: vi.fn().mockResolvedValue({ scores_created: 0 }),
    disableExpired: vi.fn().mockResolvedValue({ scores_disabled: 0 }),
    syncExternalAccess: vi.fn().mockResolvedValue({ status: 'active' }),
    enqueueJob: vi.fn(),
    claimJobs: vi.fn().mockResolvedValue([]),
    completeJob: vi.fn().mockResolvedValue(true),
    failJob: vi.fn().mockResolvedValue('pending'),
    markActivationFailed: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Internal Plans Phase 1 domain rules', () => {
  it('preserves the exact remote plan names and IDs', () => {
    expect(INTERNAL_PLAN_RULES.psychology).toMatchObject({ legacyPlanId: 1, literalName: 'Plano de psicologia' });
    expect(INTERNAL_PLAN_RULES.weight_loss).toMatchObject({ legacyPlanId: 2, literalName: 'Plano de emagrecimento' });
    expect(INTERNAL_PLAN_RULES.family).toMatchObject({ legacyPlanId: 3, literalName: 'Plano familiar' });
  });

  it('allocates four psychology credits and omits them when the base score is missing', () => {
    expect(resolveScoreAllocations('psychology', [22])).toHaveLength(4);
    expect(resolveScoreAllocations('psychology', [])).toEqual([]);
  });

  it('allocates only available weight-loss score types', () => {
    expect(resolveScoreAllocations('weight_loss', [2, 23, 24])).toEqual([
      { legacySpecializationId: 2, sequence: 1 },
      { legacySpecializationId: 23, sequence: 1 },
      { legacySpecializationId: 24, sequence: 1 },
    ]);
    expect(resolveScoreAllocations('weight_loss', [2, 24])).toHaveLength(2);
  });

  it('allocates one shared family credit and preserves the four-person limit', () => {
    expect(resolveScoreAllocations('family', [2])).toHaveLength(1);
    expect(INTERNAL_PLAN_RULES.family.familySizeLimit).toBe(4);
  });

  it('maps only supported legacy specializations and aliases', () => {
    expect(findPlanSpecialization(2)?.localCode).toBe('clinica_medica');
    expect(findPlanSpecialization('clinico_geral')?.legacySpecializationId).toBe(2);
    expect(findPlanSpecialization(22)?.concilType).toBe('psicologo');
    expect(findPlanSpecialization(9)).toBeNull();
  });
});

describe('Internal Plans provider contract', () => {
  it('conforms to PlansProvider and normalizes activation IDs/status', async () => {
    const repository = createRepository();
    const provider: PlansProvider = new InternalPlansProvider(repository);
    const result = await provider.activatePlanSubscription({
      planSubscriptionOrderId: 'order-1', paymentChargeId: 'charge-1', externalKey: 'patient@example.com',
      planCode: 'psychology', paidAt: '2026-09-24T10:00:00Z',
    });
    expect(result).toMatchObject({ backend: 'internal', subscriptionId: 'subscription-1', status: 'active' });
    expect(repository.activate).toHaveBeenCalledOnce();
  });

  it('represents both used_now and already_used outcomes', async () => {
    const repository = createRepository({
      useScore: vi.fn().mockResolvedValue({
        outcome: 'already_used', subscription_id: 'subscription-1', subscription_score_id: 'credit-1',
        score_id: 'score-1', raw_status: 2, used_at: '2026-09-24T11:00:00Z',
      }),
    });
    const provider = new InternalPlansProvider(repository);
    await expect(provider.useSubscriptionScore({ subscriptionScoreId: 'credit-1' }))
      .resolves.toMatchObject({ outcome: 'already_used', status: 'used' });
  });

  it('normalizes family member results without changing holder/member identity', async () => {
    const provider = new InternalPlansProvider(createRepository());
    await expect(provider.addFamilyPlanMember({
      subscriptionId: 'subscription-1', holderExternalKey: 'holder@example.com', memberExternalKey: 'member@example.com',
    })).resolves.toMatchObject({ holderExternalKey: 'holder@example.com', memberExternalKey: 'member@example.com' });
  });
});

describe('Internal Plans database safeguards', () => {
  it('uses payment_charge.id as the unique activation identity and serializes activation', () => {
    expect(domainMigration).toContain('payment_charge_id UUID NOT NULL REFERENCES public.payment_charges(id) ON DELETE RESTRICT UNIQUE');
    expect(domainMigration).toContain("pg_advisory_xact_lock(pg_catalog.hashtext('internal-plan-activation|' || p_payment_charge_id::TEXT))");
    expect(domainMigration).toContain('FOR UPDATE;');
  });

  it('links the entitlement to both order and charge and persists backend affinity', () => {
    expect(domainMigration).toContain('plan_subscription_order_id UUID NOT NULL');
    expect(domainMigration).toContain("plans_backend TEXT NOT NULL DEFAULT 'external'");
    expect(domainMigration).toContain('internal_plans_subscription_id UUID');
    expect(domainMigration).toContain('internal_subscription_score_id UUID');
  });

  it('prevents duplicate score grants for activation and monthly retries', () => {
    expect(domainMigration).toContain('UNIQUE (subscription_id, score_id, grant_period, allocation_sequence)');
    expect(domainMigration).toContain('ON CONFLICT (subscription_id, score_id, grant_period, allocation_sequence) DO NOTHING');
  });

  it('implements direct and family-member lookup using active/enable filters', () => {
    expect(domainMigration).toContain('CREATE OR REPLACE FUNCTION public.find_available_internal_subscription_score');
    expect(domainMigration).toContain('WHERE subscription.status = 1');
    expect(domainMigration).toContain('AND subscription_score.status = 1');
    expect(domainMigration).toContain('FROM public.plan_subscription_members AS member');
  });

  it('locks score consumption and changes enable to used only once', () => {
    expect(domainMigration).toContain('CREATE OR REPLACE FUNCTION public.use_internal_subscription_score');
    expect(domainMigration).toMatch(/WHERE id = p_subscription_score_id\s+FOR UPDATE;/);
    expect(domainMigration).toContain("v_outcome := 'already_used'");
    expect(domainMigration).toContain('SET status = 2, used_at = now()');
  });

  it('offers atomic credit and owner finalization for migrated callers', () => {
    expect(domainMigration).toContain('CREATE OR REPLACE FUNCTION public.consume_internal_plan_credit');
    expect(domainMigration).toContain("SET status = 'used'");
    expect(domainMigration).toContain("SET coverage_status = 'plan_used'");
  });

  it('enforces family holder, active plan, duplicate and maximum-size rules', () => {
    for (const code of [
      'PLAN_FAMILY_HOLDER_REQUIRED', 'PLAN_FAMILY_SUBSCRIPTION_NOT_ACTIVE',
      'PLAN_FAMILY_SUBSCRIPTION_REQUIRED', 'PLAN_FAMILY_HOLDER_ALREADY_INCLUDED',
      'PLAN_FAMILY_MEMBER_DUPLICATE', 'PLAN_FAMILY_LIMIT_REACHED',
    ]) expect(domainMigration).toContain(code);
  });

  it('refreshes only active subscriptions once per period and expires only old enabled scores', () => {
    expect(domainMigration).toContain('CREATE OR REPLACE FUNCTION public.refresh_internal_plan_subscription_scores');
    expect(domainMigration).toContain('WHERE subscription.status = 1');
    expect(domainMigration).toContain('score.grant_period = p_period');
    expect(domainMigration).toContain('WHERE status = 1 AND created_at <= p_cutoff');
    expect(domainMigration).toContain('SET status = 3, disabled_at = now()');
  });

  it('synchronizes only app_nutricao with a unique service/user identity', () => {
    expect(domainMigration).toContain("IF v_plan_code <> 'weight_loss'");
    expect(domainMigration).toContain("'app_nutricao', v_subscription.external_key");
    expect(domainMigration).not.toContain("'app_educacao_fisica', v_subscription.external_key");
    expect(domainMigration).toContain('idx_plan_user_external_accesses_identity');
  });

  it('forces RLS and grants mutation only to service_role', () => {
    expect(domainMigration).toContain('FORCE ROW LEVEL SECURITY');
    expect(domainMigration).toContain('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated');
    expect(domainMigration).toContain('TO service_role');
  });
});

describe('Internal Plans durable jobs', () => {
  it('defines every required background operation', () => {
    for (const type of [
      'activate_plan_subscription', 'retry_plan_activation', 'refresh_monthly_subscription_scores',
      'disable_expired_subscription_scores', 'reconcile_plan_credit', 'sync_external_access',
    ]) expect(jobsMigration).toContain(`'${type}'`);
  });

  it('uses deterministic idempotency, SKIP LOCKED claims and stale-lock recovery', () => {
    expect(jobsMigration).toContain('idempotency_key TEXT NOT NULL UNIQUE');
    expect(jobsMigration).toContain('FOR UPDATE SKIP LOCKED');
    expect(jobsMigration).toContain("WHERE status = 'processing'");
    expect(jobsMigration).toContain('locked_until <= now()');
  });

  it('persists retries, exponential delay, terminal failure and observability fields', () => {
    expect(jobsMigration).toContain('attempts INTEGER NOT NULL DEFAULT 0');
    expect(jobsMigration).toContain('max_attempts INTEGER NOT NULL DEFAULT 5');
    expect(jobsMigration).toContain("'dead_letter'");
    expect(jobsMigration).toContain('power(2, greatest(0, attempts - 1))');
    expect(jobsMigration).toContain('error_code TEXT');
    expect(jobsMigration).toContain('error_message TEXT');
  });

  it('uses stable but distinct initial and operator-retry activation keys', async () => {
    const enqueueJob = vi.fn().mockResolvedValue({ id: 'job-1' });
    const repository = createRepository({ enqueueJob });
    const queue = new InternalPlansQueue(repository);
    const input = {
      planSubscriptionOrderId: 'order-1', paymentChargeId: 'charge-1', externalKey: 'patient@example.com',
      planCode: 'psychology' as const, paidAt: '2026-09-24T10:00:00Z',
    };

    await queue.enqueueActivation(input);
    await queue.enqueueActivation(input, true);

    expect(enqueueJob.mock.calls.map(([call]) => call.idempotencyKey)).toEqual([
      'plan-activation:charge-1',
      'plan-activation-retry:charge-1',
    ]);
  });

  it('completes a successfully processed activation job', async () => {
    const completeJob = vi.fn().mockResolvedValue(true);
    const repository = createRepository({
      claimJobs: vi.fn().mockResolvedValue([{
        id: 'job-1', job_type: 'activate_plan_subscription', idempotency_key: 'plan-activation:charge-1',
        payload: {
          planSubscriptionOrderId: 'order-1', paymentChargeId: 'charge-1', externalKey: 'patient@example.com',
          planCode: 'psychology', paidAt: '2026-09-24T10:00:00Z',
        }, status: 'processing', attempts: 1, max_attempts: 5,
      }]),
      completeJob,
    });

    await expect(new InternalPlansJobProcessor(repository, 'worker-1').processBatch())
      .resolves.toEqual({ claimed: 1, succeeded: 1, retried: 0, deadLetter: 0 });
    expect(completeJob).toHaveBeenCalledOnce();
  });

  it('persists processor failures for retry without completing the job', async () => {
    const completeJob = vi.fn().mockResolvedValue(true);
    const failJob = vi.fn().mockResolvedValue('pending');
    const repository = createRepository({
      claimJobs: vi.fn().mockResolvedValue([{
        id: 'job-2', job_type: 'sync_external_access', idempotency_key: 'plan-external-access:sub-1:1',
        payload: { subscriptionId: 'sub-1' }, status: 'processing', attempts: 1, max_attempts: 5,
      }]),
      syncExternalAccess: vi.fn().mockRejectedValue(new Error('temporary failure')),
      completeJob,
      failJob,
    });

    await expect(new InternalPlansJobProcessor(repository, 'worker-1').processBatch())
      .resolves.toEqual({ claimed: 1, succeeded: 0, retried: 1, deadLetter: 0 });
    expect(failJob).toHaveBeenCalledOnce();
    expect(completeJob).not.toHaveBeenCalled();
  });

  it('marks the order activation_failed when an activation job reaches dead letter', async () => {
    const markActivationFailed = vi.fn().mockResolvedValue(undefined);
    const repository = createRepository({
      claimJobs: vi.fn().mockResolvedValue([{
        id: 'job-3', job_type: 'activate_plan_subscription', idempotency_key: 'plan-activation:charge-1',
        payload: {
          planSubscriptionOrderId: 'order-1', paymentChargeId: 'charge-1', externalKey: 'patient@example.com',
          planCode: 'psychology', paidAt: '2026-09-24T10:00:00Z',
        }, status: 'processing', attempts: 5, max_attempts: 5,
      }]),
      activate: vi.fn().mockRejectedValue(new Error('terminal activation failure')),
      failJob: vi.fn().mockResolvedValue('dead_letter'),
      markActivationFailed,
    });

    await expect(new InternalPlansJobProcessor(repository, 'worker-1').processBatch())
      .resolves.toEqual({ claimed: 1, succeeded: 0, retried: 0, deadLetter: 1 });
    expect(markActivationFailed).toHaveBeenCalledWith(
      'order-1',
      'charge-1',
      'UNEXPECTED_ERROR',
      'terminal activation failure',
    );
  });
});
