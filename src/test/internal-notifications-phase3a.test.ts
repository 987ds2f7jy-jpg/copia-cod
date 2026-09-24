import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('internal notifications Phase 3A', () => {
  it('keeps every Phase 3A type key in the existing idempotent seed', () => {
    const migration = read('supabase/migrations/20260912090000_create_internal_notifications.sql');

    for (const typeKey of [
      'teleconsulta.started',
      'teleconsulta.finished',
      'queue.joined',
      'queue.accepted',
      'financial.withdrawal_requested',
      'plan.activated',
      'plan.credit_consumed',
    ]) {
      expect(migration).toContain(`('${typeKey}'`);
    }
    expect(migration).toContain('ON CONFLICT (key) DO NOTHING');
  });

  it('emits consultation lifecycle events only for real transitions', () => {
    const start = read('supabase/functions/start-consulta-session/service.ts');
    const finish = read('supabase/functions/finish-consulta/service.ts');

    expect(start).toContain("const transitionedToStarted = consultation.status !== 'em_atendimento'");
    expect(start).toContain('if (transitionedToStarted && notificationService)');
    expect(start.indexOf("typeKey: 'teleconsulta.started'")).toBeGreaterThan(
      start.indexOf('await repository.startConsultationSessionAtomically'),
    );
    expect(finish).toContain('if (transitionedToFinalized && notificationService)');
    expect(finish.indexOf("typeKey: 'teleconsulta.finished'")).toBeGreaterThan(
      finish.indexOf('await repository.updateConsultationFinish'),
    );
    expect(finish).toContain("typeKey: 'review.professional_pending'");
  });

  it('emits queue joined only for a newly created entry', () => {
    const service = read('supabase/functions/join-queue/service.ts');
    const repository = read('supabase/functions/join-queue/repository.ts');

    expect(service.indexOf("typeKey: 'queue.joined'")).toBeGreaterThan(
      service.indexOf('await repository.createQueueEntry'),
    );
    expect(service).toContain('queueEntry.createdNow !== false');
    expect(repository).toContain('createdNow: false');
    expect(repository).toContain('createdNow: true');
  });

  it('keeps queue acceptance and plan-credit consumption as separate events', () => {
    const queue = read('supabase/functions/accept-queue-entry/service.ts');
    const appointment = read('supabase/functions/accept-appointment/service.ts');

    expect(queue.indexOf("typeKey: 'queue.accepted'")).toBeGreaterThan(
      queue.indexOf('await repository.acceptQueueEntry'),
    );
    expect(queue).toContain("creditResult.reason === 'used_now'");
    expect(queue).toContain('plan_credit:${planCreditUsageId}:consumed:patient:');
    expect(appointment).toContain("planCreditResult.reason === 'used_now'");
    expect(appointment).toContain('plan_credit:${planContext.usage.id}:consumed:patient:');
    expect(queue).not.toContain("creditResult.reason === 'already_used'");
    expect(appointment).not.toContain("planCreditResult.reason === 'already_used'");
  });

  it('creates a generic withdrawal notification without financial details', () => {
    const service = read('supabase/functions/request-withdrawal/service.ts');
    const notificationBlock = service.slice(service.indexOf("typeKey: 'financial.withdrawal_requested'"));

    expect(service.indexOf("typeKey: 'financial.withdrawal_requested'")).toBeGreaterThan(
      service.indexOf('await repository.createSaque'),
    );
    expect(notificationBlock).not.toMatch(/data:\s*\{/);
    expect(notificationBlock).not.toContain('pixKey');
    expect(notificationBlock).not.toContain('bankingData');
  });

  it('emits plan activation only after the async worker completes activation', () => {
    const processor = read('supabase/functions/_shared/plans/queue/InternalPlansJobProcessor.ts');
    const worker = read('supabase/functions/internal-plans-worker/handler.ts');

    expect(processor.indexOf('await this.hooks.onActivationSucceeded')).toBeGreaterThan(
      processor.indexOf('await this.repository.completeJob'),
    );
    expect(worker).toContain("typeKey: succeeded ? 'plan.activated' : 'plan.activation_failed'");
    expect(worker).toContain("succeeded ? 'activated' : 'activation_failed'");
    expect(worker).toContain('notifyInternalBestEffort');
  });
});
