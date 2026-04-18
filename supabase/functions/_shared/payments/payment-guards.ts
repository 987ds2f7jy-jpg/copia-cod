import { AppError } from '../errors.ts';

export type PaymentOwnerGuardSnapshot = {
  ownerType: 'appointment' | 'queue' | 'solicitacao_exame';
  ownerId: string;
  paymentRequired?: boolean | null;
  paymentStatus?: string | null;
  currentPaymentChargeId?: string | null;
  grossPrice?: number | string | null;
  platformFeePercent?: number | string | null;
  platformFeeAmount?: number | string | null;
  professionalNetAmount?: number | string | null;
};

function parseMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : 0;
}

export function mapAppointmentPaymentGuardSnapshot(
  row: {
    id: string;
    payment_required?: boolean | null;
    payment_status?: string | null;
    current_payment_charge_id?: string | null;
    gross_price?: number | string | null;
    platform_fee_percent?: number | string | null;
    platform_fee_amount?: number | string | null;
    professional_net_amount?: number | string | null;
  },
): PaymentOwnerGuardSnapshot {
  return {
    ownerType: 'appointment',
    ownerId: row.id,
    paymentRequired: row.payment_required,
    paymentStatus: row.payment_status,
    currentPaymentChargeId: row.current_payment_charge_id,
    grossPrice: row.gross_price,
    platformFeePercent: row.platform_fee_percent,
    platformFeeAmount: row.platform_fee_amount,
    professionalNetAmount: row.professional_net_amount,
  };
}

export function assertPaymentReadyForOperation({
  owner,
  operation,
  fallbackGrossPrice,
}: {
  owner: PaymentOwnerGuardSnapshot | null;
  operation: string;
  fallbackGrossPrice?: number | string | null;
}) {
  if (!owner) {
    if (parseMoney(fallbackGrossPrice) <= 0) {
      return;
    }

    throw new AppError({
      status: 409,
      code: 'PAYMENT_OWNER_MISSING',
      message: 'A payable operation requires a linked financial owner.',
      details: { operation },
    });
  }

  if (owner.paymentRequired === false) {
    return;
  }

  if (!owner.currentPaymentChargeId) {
    throw new AppError({
      status: 409,
      code: 'PAYMENT_CHARGE_REQUIRED',
      message: 'A payable operation requires an active payment charge.',
      details: {
        operation,
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
      },
    });
  }

  if (owner.paymentStatus !== 'paid') {
    throw new AppError({
      status: 402,
      code: 'PAYMENT_REQUIRED',
      message: 'Payment must be confirmed before this operation can continue.',
      details: {
        operation,
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        paymentStatus: owner.paymentStatus || '',
        currentPaymentChargeId: owner.currentPaymentChargeId,
      },
    });
  }
}

export function mapPaymentContext(owner: PaymentOwnerGuardSnapshot | null) {
  if (!owner) {
    return null;
  }

  return {
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    paymentRequired: owner.paymentRequired !== false,
    paymentStatus: owner.paymentStatus || '',
    currentPaymentChargeId: owner.currentPaymentChargeId || '',
    grossPrice: parseMoney(owner.grossPrice),
    platformFeePercent: Number(owner.platformFeePercent ?? 0),
    platformFeeAmount: parseMoney(owner.platformFeeAmount),
    professionalNetAmount: parseMoney(owner.professionalNetAmount),
  };
}
