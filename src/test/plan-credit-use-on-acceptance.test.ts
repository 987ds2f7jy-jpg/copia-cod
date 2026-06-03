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

    expect(createAppointmentRepository).toContain("'/subscription-score/find'");
    expect(createAppointmentService).not.toContain('/subscription-score/use');
    expect(createAppointmentRepository).not.toContain('/subscription-score/use');
  });

  it('consumes the subscription score only inside accept-appointment', () => {
    const acceptRepository = read('supabase/functions/accept-appointment/repository.ts');
    const acceptService = read('supabase/functions/accept-appointment/service.ts');

    expect(acceptRepository).toContain("const USE_SCORE_PATH = '/subscription-score/use'");
    expect(acceptRepository).toContain('score_id: subscriptionScoreId');
    expect(acceptRepository).toContain('context.usage?.externalSubscriptionScoreId');
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

    expect(acceptRepository).toContain("status: 'used'");
    expect(acceptRepository).toContain("coverage_status: 'plan_used'");
    expect(acceptRepository).toContain("status: 'use_failed'");
    expect(acceptRepository).toContain("coverage_status: 'plan_use_failed'");
  });

  it('preserves self-pay path by only loading plan context when funding_source is plan', () => {
    const acceptRepository = read('supabase/functions/accept-appointment/repository.ts');
    const acceptService = read('supabase/functions/accept-appointment/service.ts');

    expect(acceptRepository).toContain("appointment.funding_source !== 'plan'");
    expect(acceptService).toContain('if (planContext)');
  });
});
