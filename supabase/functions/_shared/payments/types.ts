export type PaymentOwnerType = 'appointment' | 'queue' | 'solicitacao_exame';

export type PaymentChargeStatus =
  | 'payment_pending'
  | 'payment_processing'
  | 'paid'
  | 'payment_failed'
  | 'payment_expired'
  | 'refunded'
  | 'chargeback';

export type CreatePaymentChargeInput = {
  ownerType: PaymentOwnerType;
  ownerId: string;
  amount: number;
  currency?: string;
  provider?: string;
};

export type CreatedPaymentCharge = {
  paymentChargeId: string;
  externalReference: string;
  providerIdempotencyKey: string;
  provider: string;
  providerChargeId: string;
  checkoutUrl: string;
  paymentReference: string;
  status: PaymentChargeStatus;
  attemptNumber: number;
  amount: number;
  currency: string;
  paidAt?: string | null;
  reusedExisting: boolean;
};

export type MarkPaymentAsPaidInput = {
  paymentChargeId: string;
};

export type MarkPaymentAsPaidResult = {
  paymentChargeId: string;
  ownerType: PaymentOwnerType;
  ownerId: string;
  status: 'paid';
  paidAt: string;
};
