import { AppError } from '../../errors.ts';
import { createMercadoPagoProvider } from './real-provider.ts';
import { createMockPaymentProvider } from './mock-provider.ts';
import type { PaymentProvider } from './provider-interface.ts';
import type { PaymentProviderName } from './types.ts';

export function getConfiguredPaymentProviderName(): PaymentProviderName {
  return normalizePaymentProviderName(Deno.env.get('PAYMENT_PROVIDER') || 'mock');
}

export function normalizePaymentProviderName(providerName: string): PaymentProviderName {
  const configured = providerName.trim().toLowerCase();

  if (configured === 'mock' || configured === 'internal_simulated') {
    return 'mock';
  }

  if (configured === 'mercadopago' || configured === 'mercado_pago') {
    return 'mercadopago';
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
    ? normalizePaymentProviderName(providerName)
    : getConfiguredPaymentProviderName();

  if (normalizedProviderName === 'mock') {
    return createMockPaymentProvider();
  }

  if (normalizedProviderName === 'mercadopago') {
    return createMercadoPagoProvider();
  }

  throw new AppError({
    status: 500,
    code: 'PAYMENT_PROVIDER_UNSUPPORTED',
    message: 'Configured payment provider is not supported.',
    details: { provider: normalizedProviderName },
  });
}
