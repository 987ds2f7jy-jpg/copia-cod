import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Internal Plans Phase 2A runtime wiring', () => {
  it('centralizes active access in the internal facade', () => {
    const facade = read('supabase/functions/_shared/plans/facade.ts');
    expect(facade).toContain('new InternalPlansProvider(repository)');
    expect(facade).toContain('new InternalPlansQueue(repository)');
    expect(facade).not.toContain("../plans-service/client");
  });

  it('queues payment-confirmed activation without waiting for provisioning', () => {
    const activation = read('supabase/functions/_shared/plans/activate-plan-subscription.ts');
    expect(activation).toContain('enqueueActivation(input, retry)');
    expect(activation).toContain("status: 'activating_plan'");
    expect(activation).toContain("reason: 'activation_queued'");
    expect(activation).not.toContain('activateExternalPlanSubscription');
  });

  it('routes retry through the dedicated internal retry job', () => {
    const retry = read('supabase/functions/retry-plan-activation/index.ts');
    const queue = read('supabase/functions/_shared/plans/queue/InternalPlansQueue.ts');
    expect(retry).toContain('retry: true');
    expect(queue).toContain('plan-activation-retry:');
  });

  it('uses the internal provider for coverage and preserves actual entitlements', () => {
    const coverage = read('supabase/functions/_shared/plans/coverage.ts');
    expect(coverage).toContain('getPlansFacade(client)');
    expect(coverage).toContain('findAvailableSubscriptionScore');
    expect(coverage).not.toContain('/subscription-score/find');
    expect(coverage).toContain('internalSubscriptionScoreId');
  });

  it('reserves internal score IDs without overwriting external identifiers', () => {
    const migration = read('supabase/migrations/20260924100000_activate_internal_plans_runtime.sql');
    expect(migration).toContain('create_internal_plan_funded_appointment');
    expect(migration).toContain('create_internal_plan_funded_queue');
    expect(migration).toContain("SET plans_backend = 'internal', internal_subscription_score_id");
    expect(migration).toContain('NULL, NULL, NULL, NULL, NULL');
  });

  it('consumes appointment and queue credits through the atomic internal RPC', () => {
    const consumption = read('supabase/functions/_shared/plans/credit-consumption.ts');
    const appointment = read('supabase/functions/accept-appointment/repository.ts');
    const queue = read('supabase/functions/accept-queue-entry/repository.ts');
    expect(consumption).toContain('getPlansFacade(client).consumePlanCredit');
    expect(consumption).not.toContain('/subscription-score/use');
    expect(appointment).toContain('internalSubscriptionScoreId: usage.internal_subscription_score_id');
    expect(queue).toContain('internal_subscription_score_id');
  });

  it('loads My Plans and reconciliation from internal state', () => {
    const myPlans = read('supabase/functions/get-my-plans/index.ts');
    const reconciliation = read('supabase/functions/reconcile-financial-owner/repository.ts');
    const internalRepository = read('supabase/functions/_shared/plans/internal/repositories/InternalPlansRepository.ts');
    expect(myPlans).toContain('getPlansFacade(client).listSubscriptionScores');
    expect(myPlans).not.toContain('listExternalPlanScores');
    expect(reconciliation).toContain('plans.reconcilePlanCredit');
    expect(reconciliation).not.toContain('reconcile_internal_plan_credit_usage');
    expect(internalRepository).toContain("'reconcile_internal_plan_credit_usage'");
    expect(reconciliation).toContain('PLAN_CREDIT_CONFIRMED_INTERNALLY');
    expect(reconciliation).not.toContain('listExternalPlanScores');
  });

  it('keeps the external client present but disconnected from active callers', () => {
    expect(fs.existsSync(path.join(root, 'supabase/functions/_shared/plans-service/client.ts'))).toBe(true);
    for (const file of [
      'supabase/functions/_shared/plans/activate-plan-subscription.ts',
      'supabase/functions/_shared/plans/coverage.ts',
      'supabase/functions/_shared/plans/credit-consumption.ts',
      'supabase/functions/check-plan-coverage/index.ts',
      'supabase/functions/get-my-plans/index.ts',
      'supabase/functions/reconcile-financial-owner/repository.ts',
    ]) {
      expect(read(file)).not.toContain("plans-service/client.ts");
    }
  });
});
