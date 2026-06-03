import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  'supabase/functions/get-patient-payments/index.ts',
  'utf8',
);

describe('patient payments plan subscriptions contract', () => {
  it('includes plan_subscription as a supported payment owner without removing legacy owners', () => {
    expect(source).toContain(
      "type OwnerType = 'appointment' | 'queue' | 'solicitacao_exame' | 'plan_subscription';",
    );

    expect(source).toContain("listChargesForOwnerType(client, 'appointment'");
    expect(source).toContain("listChargesForOwnerType(client, 'queue'");
    expect(source).toContain("listChargesForOwnerType(client, 'solicitacao_exame'");
    expect(source).toContain("listChargesForOwnerType(client, 'plan_subscription'");
  });

  it('loads plan subscription owners through the authenticated patient before reading charges', () => {
    expect(source).toContain('async function listPlanSubscriptionOwners');
    expect(source).toContain(".from('plan_subscription_orders')");
    expect(source).toContain('.or(`patient_id.eq.${patientId},app_user_id.eq.${patientId}`)');
    expect(source).toContain("planSubscriptions.map((owner) => owner.id)");
  });

  it('maps plan codes to stable payment service labels for the frontend', () => {
    expect(source).toContain("plan_subscription_weight_loss: 'Plano Emagrecimento'");
    expect(source).toContain("plan_subscription_family: 'Plano Familiar'");
    expect(source).toContain("plan_subscription_psychology: 'Plano Psicologia'");
    expect(source).toContain("service_code: planCode ? `plan_subscription_${planCode}` : 'plan_subscription'");
  });
});
