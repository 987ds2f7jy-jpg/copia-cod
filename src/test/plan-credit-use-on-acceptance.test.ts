import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('plan credit consumption on professional acceptance', () => {
  it('keeps plan credit consumption out of appointment creation', () => {
    const createAppointmentRepository = read('supabase/functions/create-appointment/repository.ts');
    const createAppointmentService = read('supabase/functions/create-appointment/service.ts');
    const coverage = read('supabase/functions/_shared/plans/coverage.ts');

    expect(createAppointmentRepository).toContain('resolvePlanCoverage');
    expect(coverage).toContain('findAvailableSubscriptionScore');
    expect(createAppointmentService).not.toContain('/subscription-score/use');
    expect(coverage).not.toContain('/subscription-score/find');
  });

  it('consumes the subscription score only inside accept-appointment', () => {
    const acceptRepository = read('supabase/functions/accept-appointment/repository.ts');
    const acceptService = read('supabase/functions/accept-appointment/service.ts');

    expect(acceptRepository).toContain("consumePlanCreditOnce({");
    expect(acceptRepository).toContain('usage.internalSubscriptionScoreId');
    expect(acceptService).toContain('confirmPlanCreditBeforeAcceptance');
    expect(acceptService).toContain('repository.acceptAppointment');
    expect(acceptService.indexOf('confirmPlanCreditBeforeAcceptance')).toBeLessThan(
      acceptService.indexOf('repository.acceptAppointment'),
    );
  });

  it('blocks expired specialty appointments before plan credit consumption', () => {
    const acceptService = read('supabase/functions/accept-appointment/service.ts');
    const acceptRepository = read('supabase/functions/accept-appointment/repository.ts');
    const rpcPatch = read('supabase/migrations/20260602120000_block_expired_specialty_appointment_acceptance.sql');

    expect(acceptService).toContain('assertAppointmentNotExpiredForAcceptance');
    expect(acceptService).toContain('findAppointmentAcceptanceWindow');
    expect(acceptService.indexOf('assertAppointmentNotExpiredForAcceptance')).toBeLessThan(
      acceptService.indexOf('confirmPlanCreditBeforeAcceptance'),
    );
    expect(acceptRepository).toContain('APPOINTMENT_EXPIRED');
    expect(rpcPatch).toContain('MESSAGE = \'APPOINTMENT_EXPIRED\'');
    expect(rpcPatch).toContain("interval '10 minutes'");
    expect(rpcPatch.indexOf('MESSAGE = \'APPOINTMENT_EXPIRED\'')).toBeLessThan(
      rpcPatch.indexOf('INSERT INTO public.consultas'),
    );
  });

  it('updates local audit and appointment coverage status after use result', () => {
    const acceptRepository = read('supabase/functions/accept-appointment/repository.ts');
    const migration = read('supabase/migrations/20260924090000_create_internal_plans_domain.sql');
    const consumption = read('supabase/functions/_shared/plans/credit-consumption.ts');

    expect(consumption).toContain('getPlansFacade(client).consumePlanCredit');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.consume_internal_plan_credit');
    expect(migration).toContain("SET status = 'used'");
    expect(migration).toContain("SET coverage_status = 'plan_used'");
    expect(consumption).not.toContain('/subscription-score/use');
  });

  it('locks and finalizes score, usage and owner in one internal transaction', () => {
    const migration = read('supabase/migrations/20260924090000_create_internal_plans_domain.sql');

    expect(migration).toMatch(/WHERE id = p_subscription_score_id\s+FOR UPDATE;/);
    expect(migration).toMatch(/WHERE id = p_usage_id AND owner_type = p_owner_type AND owner_id = p_owner_id\s+FOR UPDATE;/);
    expect(migration).toContain("SET status = 'used'");
    expect(migration).toContain("SET coverage_status = 'plan_used'");
  });

  it('preserves self-pay path by only loading plan context when funding_source is plan', () => {
    const acceptRepository = read('supabase/functions/accept-appointment/repository.ts');
    const acceptService = read('supabase/functions/accept-appointment/service.ts');

    expect(acceptRepository).toContain("appointment.funding_source !== 'plan'");
    expect(acceptService).toContain('if (planContext)');
  });
});
