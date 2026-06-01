import { AppError } from '../errors.ts';
import { activatePlanSubscriptionForPayment } from '../plans/activate-plan-subscription.ts';
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

type PlanSubscriptionPaymentState = {
  id: string;
  status: string;
  payment_status: string | null;
  current_payment_charge_id: string | null;
  paid_at: string | null;
};

const OWNER_TABLE: Record<PaymentOwnerType, string> = {
  appointment: 'appointments',
  queue: 'queues',
  solicitacao_exame: 'solicitacoes_exames',
  plan_subscription: 'plan_subscription_orders',
};

async function activatePlanOwnerIfNeeded(
  client: SupabaseClient,
  charge: PaymentChargeRow,
) {
  if (charge.owner_type !== 'plan_subscription') {
    return null;
  }

  return activatePlanSubscriptionForPayment(client, {
    paymentChargeId: charge.id,
  });
}

async function loadPlanSubscriptionPaymentState(
  client: SupabaseClient,
  ownerId: string,
) {
  const { data, error } = await client
    .from('plan_subscription_orders')
    .select('id, status, payment_status, current_payment_charge_id, paid_at')
    .eq('id', ownerId)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_OWNER_LOOKUP_FAILED',
      message: 'Unable to load plan subscription order.',
      details: error.message,
    });
  }

  const order = data as PlanSubscriptionPaymentState | null;

  if (!order?.id) {
    throw new AppError({
      status: 404,
      code: 'PAYMENT_OWNER_NOT_FOUND',
      message: 'Payment owner was not found.',
      details: { ownerType: 'plan_subscription', ownerId },
    });
  }

  return order;
}

async function updatePlanSubscriptionAsPaid(
  client: SupabaseClient,
  ownerId: string,
  paymentChargeId: string,
  paidAt: string,
) {
  const order = await loadPlanSubscriptionPaymentState(client, ownerId);

  if (order.status === 'active') {
    const updatePayload: Record<string, unknown> = {};

    if (order.payment_status !== 'paid') {
      updatePayload.payment_status = 'paid';
    }

    if (!order.current_payment_charge_id) {
      updatePayload.current_payment_charge_id = paymentChargeId;
    }

    if (!order.paid_at) {
      updatePayload.paid_at = paidAt;
    }

    if (Object.keys(updatePayload).length === 0) {
      return;
    }

    const { error } = await client
      .from('plan_subscription_orders')
      .update(updatePayload)
      .eq('id', ownerId);

    if (error) {
      throw new AppError({
        status: 500,
        code: 'PAYMENT_OWNER_PAID_UPDATE_FAILED',
        message: 'Unable to update active plan subscription payment fields.',
        details: error.message,
      });
    }

    return;
  }

  const { error } = await client
    .from('plan_subscription_orders')
    .update({
      payment_status: 'paid',
      paid_at: paidAt,
      current_payment_charge_id: paymentChargeId,
      status: 'payment_confirmed',
    })
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

async function updateOwnerAsPaid(
  client: SupabaseClient,
  ownerType: PaymentOwnerType,
  ownerId: string,
  paymentChargeId: string,
  paidAt: string,
) {
  if (ownerType === 'plan_subscription') {
    await updatePlanSubscriptionAsPaid(client, ownerId, paymentChargeId, paidAt);
    return;
  }

  const updatePayload: Record<string, unknown> = {
    payment_status: 'paid',
    paid_at: paidAt,
    current_payment_charge_id: paymentChargeId,
  };

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
    const activation = await activatePlanOwnerIfNeeded(client, charge);

    return {
      paymentChargeId: charge.id,
      ownerType: charge.owner_type,
      ownerId: charge.owner_id,
      status: 'paid',
      paidAt,
      activation,
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
  const activation = await activatePlanOwnerIfNeeded(client, charge);

  return {
    paymentChargeId: charge.id,
    ownerType: charge.owner_type,
    ownerId: charge.owner_id,
    status: 'paid',
    paidAt,
    activation,
  };
}
