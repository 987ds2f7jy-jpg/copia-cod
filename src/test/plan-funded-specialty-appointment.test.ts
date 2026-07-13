import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('plan-funded specialty appointment contract', () => {
  it('adds local audit fields for plan-funded appointments', () => {
    const migration = read('supabase/migrations/20260601090000_add_plan_funding_to_appointments.sql');

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.plan_credit_usages');
    expect(migration).toContain("funding_source TEXT NOT NULL DEFAULT 'self_pay'");
    expect(migration).toContain("CHECK (funding_source IN ('self_pay', 'plan'))");
    expect(migration).toContain("status IN ('pending_use', 'used', 'use_failed', 'canceled', 'released')");
    expect(migration).toContain('idx_plan_credit_usages_open_external_score_unique');
  });

  it('keeps credit consumption out of create-appointment phase 1', () => {
    const createAppointmentFiles = [
      read('supabase/functions/create-appointment/repository.ts'),
      read('supabase/functions/create-appointment/service.ts'),
      read('supabase/functions/create-appointment/types.ts'),
      read('supabase/functions/create-appointment/validation.ts'),
    ].join('\n');

    const coverage = read('supabase/functions/_shared/plans/coverage.ts');

    expect(coverage).toContain("const FIND_SCORE_PATH = '/subscription-score/find'");
    expect(createAppointmentFiles).not.toContain('/subscription-score/use');
  });

  it('creates payment charges only for payment-required appointments', () => {
    const repository = read('supabase/functions/create-appointment/repository.ts');
    const planTransactionIndex = repository.indexOf(".rpc('create_plan_funded_appointment'");
    const paymentChargeIndex = repository.indexOf('createPaymentCharge(client');

    expect(planTransactionIndex).toBeGreaterThan(-1);
    expect(paymentChargeIndex).toBeGreaterThan(-1);
    expect(planTransactionIndex).toBeLessThan(paymentChargeIndex);
    expect(repository).toContain('const paymentRequired = !isPlanFunded');
    expect(repository).toContain("funding_source: params.fundingSource");
  });

  it('shows the backend decision without letting the UI force self-pay over valid coverage', () => {
    const page = read('src/pages/AgendamentoEspecialidade.jsx');
    const client = read('src/client-api/appointments.js');

    expect(page).toContain('Coberto pelo plano. A cobertura sera revalidada ao enviar.');
    expect(page).not.toContain('onClick={() => setFundingSource');
    expect(page).toContain('Enviar solicitacao usando plano');
    expect(page).toContain('!isPlanFundedAppointment && appointmentPayment?.status');
    expect(client).toContain('fundingSource =');
    expect(client).toContain('fundingSource,');
    expect(page).not.toContain('/subscription-score/use');
  });
});
