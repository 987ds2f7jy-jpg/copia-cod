import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Plans notifications on the internal runtime', () => {
  it('registers exactly the five requested new Plans notification types', () => {
    const migration = read('supabase/migrations/20260924110000_add_internal_plans_notification_types.sql');
    const keys = [...migration.matchAll(/'plan\.[a-z_]+'/g)].map(([key]) => key);

    expect(keys).toEqual([
      "'plan.credit_reserved'",
      "'plan.coverage_denied'",
      "'plan.expiring'",
      "'plan.expired'",
      "'plan.cancelled'",
    ]);
    expect(migration).toContain('ON CONFLICT (key) DO NOTHING');
  });

  it('emits activation outcomes from the internal durable worker with stable owner keys', () => {
    const processor = read('supabase/functions/_shared/plans/queue/InternalPlansJobProcessor.ts');
    const worker = read('supabase/functions/internal-plans-worker/handler.ts');

    expect(processor).toContain('await this.repository.completeJob');
    expect(processor).toContain('await this.repository.markActivationFailed');
    expect(worker).toContain("typeKey: succeeded ? 'plan.activated' : 'plan.activation_failed'");
    expect(worker).toContain("relatedEntityType: 'plan'");
    expect(worker).toContain("succeeded ? 'activated' : 'activation_failed'");
    expect(worker).not.toContain('plans-service');
  });

  it('emits credit consumption only for the internal used_now result', () => {
    const consumption = read('supabase/functions/_shared/plans/credit-consumption.ts');
    const appointment = read('supabase/functions/accept-appointment/service.ts');
    const queue = read('supabase/functions/accept-queue-entry/service.ts');

    expect(consumption).toContain('getPlansFacade(client).consumePlanCredit');
    expect(consumption).not.toContain('/subscription-score/use');
    expect(appointment).toContain("planCreditResult.reason === 'used_now'");
    expect(queue).toContain("creditResult.reason === 'used_now'");
    expect(appointment).toContain('plan_credit:${planContext.usage.id}:consumed:patient:');
    expect(queue).toContain('plan_credit:${planCreditUsageId}:consumed:patient:');
  });

  it('does not emit coverage denial from the read-only coverage endpoint', () => {
    const endpoint = read('supabase/functions/check-plan-coverage/index.ts');
    expect(endpoint).not.toContain('plan.coverage_denied');
    expect(endpoint).not.toContain('InternalNotificationService');
  });

  it('does not invent subscription expiration or cancellation transitions', () => {
    const domain = read('supabase/migrations/20260924090000_create_internal_plans_domain.sql');
    const functions = [
      read('supabase/functions/_shared/plans/internal/repositories/InternalPlansRepository.ts'),
      read('supabase/functions/_shared/plans/queue/InternalPlansJobProcessor.ts'),
      read('supabase/functions/internal-plans-worker/handler.ts'),
    ].join('\n');

    expect(domain).not.toMatch(/\b(expires_at|valid_until|ends_at|period_end)\b/);
    expect(domain).not.toContain('cancel_internal_plan_subscription');
    expect(functions).not.toContain("typeKey: 'plan.expiring'");
    expect(functions).not.toContain("typeKey: 'plan.expired'");
    expect(functions).not.toContain("typeKey: 'plan.cancelled'");
  });
});
