import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isLocalPaymentEnvironment } from '../../supabase/functions/_shared/payments/environment-policy';
import { resolvePaymentProviderConfiguration } from '../../supabase/functions/_shared/payments/providers/index';

function read(relativePath: string) {
  return readFileSync(relativePath, 'utf8');
}

describe('payment environment hardening', () => {
  it('allows mock only in explicit local development and test environments', () => {
    expect(isLocalPaymentEnvironment('local')).toBe(true);
    expect(isLocalPaymentEnvironment('development')).toBe(true);
    expect(isLocalPaymentEnvironment('test')).toBe(true);
    expect(isLocalPaymentEnvironment('staging')).toBe(false);
    expect(isLocalPaymentEnvironment('production')).toBe(false);
    expect(resolvePaymentProviderConfiguration('mock', 'test')).toBe('mock');
    expect(() => resolvePaymentProviderConfiguration('mock', 'staging')).toThrowError(
      expect.objectContaining({ code: 'PAYMENT_PROVIDER_MOCK_FORBIDDEN' }),
    );
  });

  it('fails closed when provider is absent', () => {
    expect(() => resolvePaymentProviderConfiguration('', 'staging')).toThrowError(
      expect.objectContaining({ code: 'PAYMENT_PROVIDER_REQUIRED' }),
    );
    expect(resolvePaymentProviderConfiguration('stripe', 'staging')).toBe('stripe');
    expect(resolvePaymentProviderConfiguration('mercadopago', 'production')).toBe('mercadopago');
  });

  it('keeps payment simulation secrets out of the browser bundle', () => {
    const frontendEnv = read('src/config/env.ts');
    const paymentsClient = read('src/client-api/payments.js');
    const envExample = read('.env.example');
    const forbiddenViteSecretName = ['VITE', 'PAYMENT', 'SIMULATION', 'SECRET'].join('_');

    expect(frontendEnv).not.toContain(forbiddenViteSecretName);
    expect(frontendEnv).not.toContain('paymentSimulationSecret');
    expect(paymentsClient).not.toContain('x-payment-simulation-secret');
    expect(envExample).not.toContain(forbiddenViteSecretName);
  });

  it('requires local environment, authentication and charge ownership in simulation endpoint', () => {
    const simulationHandler = read('supabase/functions/simulate-payment-paid/handler.ts');

    expect(simulationHandler).toContain('isLocalPaymentEnvironment');
    expect(simulationHandler).toContain("Deno.env.get('ENABLE_PAYMENT_SIMULATION')");
    expect(simulationHandler).toContain('requireAuthenticatedUser');
    expect(simulationHandler).toContain('assertPaymentChargeOwnership');
    expect(simulationHandler).toContain('PAYMENT_SIMULATION_FORBIDDEN');
    expect(simulationHandler).not.toContain('PAYMENT_SIMULATION_SECRET');
  });
});
