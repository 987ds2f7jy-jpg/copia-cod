import { AppError } from '../../errors.ts';
import type { PaymentProvider } from './provider-interface.ts';

function buildMockPayload(input: Record<string, unknown>) {
  return {
    simulated: true,
    ...input,
  };
}

export function createMockPaymentProvider(): PaymentProvider {
  return {
    name: 'mock',

    async createCharge(input) {
      const providerChargeId = `mock_${input.internalChargeId}`;

      return {
        provider: 'mock',
        providerChargeId,
        checkoutUrl: '',
        paymentReference: input.externalReference,
        raw: buildMockPayload({
          providerChargeId,
          externalReference: input.externalReference,
          amount: input.amount,
          currency: input.currency,
        }),
      };
    },

    async getChargeStatus(providerChargeId) {
      return {
        provider: 'mock',
        providerChargeId,
        paymentReference: providerChargeId,
        externalReference: '',
        status: 'payment_pending',
        rawStatus: 'pending',
        amount: 0,
        currency: 'BRL',
        paidAt: null,
        failureReason: '',
        raw: buildMockPayload({ providerChargeId, status: 'pending' }),
      };
    },

    async verifyWebhook() {
      throw new AppError({
        status: 400,
        code: 'MOCK_WEBHOOK_UNSUPPORTED',
        message: 'Mock provider does not support real webhook processing.',
      });
    },
  };
}
