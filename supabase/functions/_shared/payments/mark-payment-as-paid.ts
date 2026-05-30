import { AppError } from '../errors.ts';
import type { SupabaseClient } from '../supabase.ts';
import type {
  MarkPaymentAsPaidInput,
  MarkPaymentAsPaidResult,
  PaymentChargeStatus,
  PaymentOwnerType,
} from './types.ts';

type PaymentChargeRow = {
  id: string;
  owner_type: PaymentOwnerType;
  owner_id: string;
  status: PaymentChargeStatus;
  paid_at: string | null;
};

const OWNER_TABLE: Record<PaymentOwnerType, string> = {
  appointment: 'appointments',
  queue: 'queues',
  solicitacao_exame: 'solicitacoes_exames',
  plan_subscription: 'plan_subscription_orders',
};

async function updateOwnerAsPaid(
  client: SupabaseClient,
  ownerType: PaymentOwnerType,
  ownerId: string,
  paymentChargeId: string,
  paidAt: string,
) {
  const updatePayload: Record<string, unknown> = {
    payment_status: 'paid',
    paid_at: paidAt,
    current_payment_charge_id: paymentChargeId,
  };

  if (ownerType === 'plan_subscription') {
    updatePayload.status = 'payment_confirmed';
  }

  const { error } = await client
    .from(OWNER_TABLE[ownerType])
    .update(updatePayload)
    .eq('id', ownerId);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_OWNER_PAID_UPDATE_FAILED',
      message: 'Unable to update payment owner as paid.',
      details: error.message,
    });
  }
}

export async function markPaymentAsPaid(
  client: SupabaseClient,
  input: MarkPaymentAsPaidInput,
): Promise<MarkPaymentAsPaidResult> {
  const { data, error } = await client
    .from('payment_charges')
    .select('id, owner_type, owner_id, status, paid_at')
    .eq('id', input.paymentChargeId)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_CHARGE_LOOKUP_FAILED',
      message: 'Unable to load payment charge.',
      details: error.message,
    });
  }

  const charge = data as PaymentChargeRow | null;

  if (!charge?.id) {
    throw new AppError({
      status: 404,
      code: 'PAYMENT_CHARGE_NOT_FOUND',
      message: 'Payment charge was not found.',
      details: { paymentChargeId: input.paymentChargeId },
    });
  }

  const paidAt = charge.paid_at || new Date().toISOString();

  if (charge.status === 'paid') {
    await updateOwnerAsPaid(client, charge.owner_type, charge.owner_id, charge.id, paidAt);

    return {
      paymentChargeId: charge.id,
      ownerType: charge.owner_type,
      ownerId: charge.owner_id,
      status: 'paid',
      paidAt,
    };
  }

  if (charge.status !== 'payment_pending' && charge.status !== 'payment_processing') {
    throw new AppError({
      status: 409,
      code: 'PAYMENT_CHARGE_NOT_PAYABLE',
      message: 'Payment charge status cannot be marked as paid.',
      details: { paymentChargeId: charge.id, status: charge.status },
    });
  }

  const { error: updateChargeError } = await client
    .from('payment_charges')
    .update({
      status: 'paid',
      paid_at: paidAt,
      last_provider_status: 'paid_simulated',
      last_provider_payload: {
        simulated: true,
        paidAt,
      },
    })
    .eq('id', charge.id);

  if (updateChargeError) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_CHARGE_PAID_UPDATE_FAILED',
      message: 'Unable to update payment charge as paid.',
      details: updateChargeError.message,
    });
  }

  await updateOwnerAsPaid(client, charge.owner_type, charge.owner_id, charge.id, paidAt);

  return {
    paymentChargeId: charge.id,
    ownerType: charge.owner_type,
    ownerId: charge.owner_id,
    status: 'paid',
    paidAt,
  };
}
