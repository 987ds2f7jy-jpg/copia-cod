import type {
  ProviderChargeStatusResult,
  ProviderCreateChargeInput,
  ProviderCreateChargeResult,
  ProviderWebhookVerificationResult,
} from './types.ts';

export type PaymentProvider = {
  name: 'mock' | 'mercadopago' | 'stripe';
  createCharge(input: ProviderCreateChargeInput): Promise<ProviderCreateChargeResult>;
  getChargeStatus(providerChargeId: string): Promise<ProviderChargeStatusResult>;
  verifyWebhook(input: {
    req: Request;
    rawBody: string;
    body: Record<string, unknown>;
  }): Promise<ProviderWebhookVerificationResult>;
};
