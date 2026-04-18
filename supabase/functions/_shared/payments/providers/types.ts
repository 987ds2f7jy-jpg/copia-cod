import type { PaymentChargeStatus, PaymentOwnerType } from '../types.ts';

export type PaymentProviderName = 'mock' | 'mercadopago';

export type ProviderCreateChargeInput = {
  internalChargeId: string;
  ownerType: PaymentOwnerType;
  ownerId: string;
  attemptNumber: number;
  amount: number;
  currency: string;
  externalReference: string;
  idempotencyKey: string;
};

export type ProviderCreateChargeResult = {
  provider: PaymentProviderName;
  providerChargeId: string;
  checkoutUrl: string;
  paymentReference: string;
  raw: Record<string, unknown>;
};

export type ProviderChargeStatusResult = {
  provider: PaymentProviderName;
  providerChargeId: string;
  paymentReference: string;
  externalReference: string;
  status: PaymentChargeStatus;
  rawStatus: string;
  amount: number;
  currency: string;
  paidAt: string | null;
  failureReason: string;
  raw: Record<string, unknown>;
};

export type ProviderWebhookVerificationResult = {
  eventId: string;
  eventType: string;
  providerChargeId: string;
  externalReference: string;
};
