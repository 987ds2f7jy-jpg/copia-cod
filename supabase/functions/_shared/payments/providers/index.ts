import { AppError } from '../../errors.ts';
import { createMercadoPagoProvider } from './real-provider.ts';
import { createMockPaymentProvider } from './mock-provider.ts';
import { createStripePaymentProvider } from './stripe-provider.ts';
import type { PaymentProvider } from './provider-interface.ts';
import type { PaymentProviderName } from './types.ts';
import {
  isLocalPaymentEnvironment,
  normalizeAppEnvironment,
} from '../environment-policy.ts';

function getRuntimeEnvironment() {
  return normalizeAppEnvironment(Deno.env.get('APP_ENV'));
}

export function getConfiguredPaymentProviderName(): PaymentProviderName {
  return resolvePaymentProviderConfiguration(
    Deno.env.get('PAYMENT_PROVIDER') || '',
    getRuntimeEnvironment(),
  );
}

export function resolvePaymentProviderConfiguration(
  providerName: string,
  environment: string,
): PaymentProviderName {
  const configuredProvider = providerName.trim();

  if (!configuredProvider) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_PROVIDER_REQUIRED',
      message: 'PAYMENT_PROVIDER must be configured explicitly.',
    });
  }

  const normalizedProviderName = normalizePaymentProviderName(configuredProvider);
  const normalizedEnvironment = normalizeAppEnvironment(environment);

  if (normalizedProviderName === 'mock' && !isLocalPaymentEnvironment(normalizedEnvironment)) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_PROVIDER_MOCK_FORBIDDEN',
      message: 'Mock payments are restricted to local development and test environments.',
      details: { environment: normalizedEnvironment },
    });
  }

  return normalizedProviderName;
}

export function normalizePaymentProviderName(providerName: string): PaymentProviderName {
  const configured = providerName.trim().toLowerCase();

  if (configured === 'mock' || configured === 'internal_simulated') {
    return 'mock';
  }

  if (configured === 'mercadopago' || configured === 'mercado_pago') {
    return 'mercadopago';
  }

  if (configured === 'stripe') {
    return 'stripe';
  }

  throw new AppError({
    status: 500,
    code: 'PAYMENT_PROVIDER_UNSUPPORTED',
    message: 'Configured payment provider is not supported.',
    details: { provider: configured },
  });
}

export function createPaymentProvider(providerName?: string | PaymentProviderName): PaymentProvider {
  const normalizedProviderName = providerName
    ? resolvePaymentProviderConfiguration(providerName, getRuntimeEnvironment())
    : getConfiguredPaymentProviderName();

  if (normalizedProviderName === 'mock') {
    return createMockPaymentProvider();
  }

  if (normalizedProviderName === 'mercadopago') {
    return createMercadoPagoProvider();
  }

  if (normalizedProviderName === 'stripe') {
    return createStripePaymentProvider();
  }

  throw new AppError({
    status: 500,
    code: 'PAYMENT_PROVIDER_UNSUPPORTED',
    message: 'Configured payment provider is not supported.',
    details: { provider: normalizedProviderName },
  });
}
