import type { AuthenticatedUser } from '../_shared/types.ts';

export type PaymentOwnerType = 'appointment' | 'queue' | 'solicitacao_exame' | 'plan_subscription';

export type GetPaymentStatusInput = {
  chargeId: string;
};

export type PaymentChargeRecord = {
  id: string;
  ownerType: PaymentOwnerType;
  ownerId: string;
  status: string;
  updatedAt: string;
};

export type PaymentOwnerRecord = {
  id: string;
  patientId: string;
  currentPaymentChargeId: string | null;
  paymentStatus: string;
  operationalStatus: string;
  consultaId: string | null;
};

export type GetPaymentStatusResult = {
  chargeId: string;
  ownerType: PaymentOwnerType;
  ownerId: string;
  status: string;
  serviceReleased: boolean;
  updatedAt: string;
};

export type GetPaymentStatusRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<{
    id: string;
    role: string;
    isActive: boolean;
  } | null>;
  findPaymentChargeById(chargeId: string): Promise<PaymentChargeRecord | null>;
  findPaymentOwner(charge: PaymentChargeRecord): Promise<PaymentOwnerRecord | null>;
};

export type GetPaymentStatusCommand = {
  requestId: string;
  input: GetPaymentStatusInput;
  authenticatedUser: AuthenticatedUser;
};
