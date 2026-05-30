import { AppError, isAppError } from '../errors.ts';
import {
  activateExternalPlanSubscription,
  type ActivateExternalPlanPayload,
} from '../plans-service/client.ts';
import type { SupabaseClient } from '../supabase.ts';

type PaymentChargeRow = {
  id: string;
  owner_type: string;
  owner_id: string;
  status: string;
  amount: number | string | null;
  currency: string | null;
  provider: string | null;
  provider_charge_id: string | null;
  provider_payment_reference: string | null;
  paid_at: string | null;
};

type PlanSubscriptionOrderRow = {
  id: string;
  patient_id: string | null;
  app_user_id: string | null;
  plan_code: string;
  external_plan_id: number | string | null;
  amount: number | string | null;
  currency: string | null;
  status: string;
  payment_status: string | null;
  current_payment_charge_id: string | null;
  external_key: string | null;
  paid_at: string | null;
};

type AppUserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  cpf: string | null;
};

export type PlanActivationResult = {
  skipped: boolean;
  activated: boolean;
  orderId: string;
  paymentChargeId: string;
  status: string;
  reason: string;
  plansServiceSubscriptionId: string | null;
  errorCode?: string;
  errorMessage?: string;
};

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function parseMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : 0;
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || '';

  return {
    firstName,
    lastName: parts.join(' '),
  };
}

function sanitizeDocument(value: unknown) {
  return normalizeString(value).replace(/\D/g, '');
}

function appErrorFromUnknown(error: unknown) {
  if (isAppError(error)) {
    return error;
  }

  return new AppError({
    status: 500,
    code: 'plan_activation_unexpected_error',
    message: 'Unexpected plan activation error.',
    details: error instanceof Error ? error.message : undefined,
  });
}

function snapshotFromError(error: AppError) {
  if (error.details && typeof error.details === 'object' && !Array.isArray(error.details)) {
    const details = error.details as Record<string, unknown>;

    if ('payload' in details) {
      return {
        error: {
          code: error.code,
          message: error.message,
          status: error.status,
        },
        payload: details.payload,
      };
    }

    return {
      error: {
        code: error.code,
        message: error.message,
        status: error.status,
        details,
      },
    };
  }

  return {
    error: {
      code: error.code,
      message: error.message,
      status: error.status,
    },
  };
}

async function loadPaymentCharge(client: SupabaseClient, paymentChargeId: string) {
  const { data, error } = await client
    .from('payment_charges')
    .select(`
      id,
      owner_type,
      owner_id,
      status,
      amount,
      currency,
      provider,
      provider_charge_id,
      provider_payment_reference,
      paid_at
    `)
    .eq('id', paymentChargeId)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_CHARGE_LOOKUP_FAILED',
      message: 'Unable to load payment charge for plan activation.',
      details: error.message,
    });
  }

  const charge = data as PaymentChargeRow | null;

  if (!charge?.id) {
    throw new AppError({
      status: 404,
      code: 'PAYMENT_CHARGE_NOT_FOUND',
      message: 'Payment charge was not found for plan activation.',
      details: { paymentChargeId },
    });
  }

  return charge;
}

async function loadOrder(client: SupabaseClient, orderId: string) {
  const { data, error } = await client
    .from('plan_subscription_orders')
    .select(`
      id,
      patient_id,
      app_user_id,
      plan_code,
      external_plan_id,
      amount,
      currency,
      status,
      payment_status,
      current_payment_charge_id,
      external_key,
      paid_at
    `)
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PLAN_ORDER_LOOKUP_FAILED',
      message: 'Unable to load plan subscription order.',
      details: error.message,
    });
  }

  const order = data as PlanSubscriptionOrderRow | null;

  if (!order?.id) {
    throw new AppError({
      status: 404,
      code: 'PLAN_ORDER_NOT_FOUND',
      message: 'Plan subscription order was not found.',
      details: { orderId },
    });
  }

  return order;
}

async function loadAppUser(client: SupabaseClient, appUserId: string) {
  const { data, error } = await client
    .from('app_users')
    .select('id, full_name, email, cpf')
    .eq('id', appUserId)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'APP_USER_LOOKUP_FAILED',
      message: 'Unable to load patient for plan activation.',
      details: error.message,
    });
  }

  const appUser = data as AppUserRow | null;

  if (!appUser?.id) {
    throw new AppError({
      status: 404,
      code: 'APP_USER_NOT_FOUND',
      message: 'Patient was not found for plan activation.',
      details: { appUserId },
    });
  }

  return appUser;
}

function buildActivationPayload({
  order,
  charge,
  appUser,
}: {
  order: PlanSubscriptionOrderRow;
  charge: PaymentChargeRow;
  appUser: AppUserRow;
}): ActivateExternalPlanPayload {
  const fullName = normalizeString(appUser.full_name);
  const { firstName, lastName } = splitFullName(fullName);
  const email = normalizeString(appUser.email || order.external_key);
  const externalKey = normalizeString(order.external_key || email);
  const paidAt = charge.paid_at || order.paid_at || new Date().toISOString();

  if (!externalKey || !email) {
    throw new AppError({
      status: 422,
      code: 'plan_activation_external_key_missing',
      message: 'Patient email is required to activate a plan.',
      details: { orderId: order.id, appUserId: appUser.id },
    });
  }

  return {
    external_key: externalKey,
    plan_code: order.plan_code,
    external_plan_id: Number(order.external_plan_id || 0) || null,
    external_payment_reference: charge.id,
    paid_at: paidAt,
    amount: parseMoney(order.amount),
    currency: normalizeString(order.currency).toUpperCase() || 'BRL',
    customer: {
      email,
      first_name: firstName,
      last_name: lastName,
      document: sanitizeDocument(appUser.cpf),
    },
    metadata: {
      source: 'rapido_doutor',
      order_id: order.id,
      payment_charge_id: charge.id,
    },
  };
}

async function markOrderActivating({
  client,
  order,
  charge,
  requestSnapshot,
}: {
  client: SupabaseClient;
  order: PlanSubscriptionOrderRow;
  charge: PaymentChargeRow;
  requestSnapshot: ActivateExternalPlanPayload;
}) {
  const { error } = await client
    .from('plan_subscription_orders')
    .update({
      status: 'activating_plan',
      payment_status: 'paid',
      current_payment_charge_id: charge.id,
      paid_at: charge.paid_at || order.paid_at || new Date().toISOString(),
      request_snapshot: requestSnapshot,
      error_code: null,
      error_message: null,
    })
    .eq('id', order.id);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PLAN_ORDER_ACTIVATING_UPDATE_FAILED',
      message: 'Unable to mark plan order as activating.',
      details: error.message,
    });
  }
}

async function markOrderActive({
  client,
  orderId,
  requestSnapshot,
  responseSnapshot,
  plansServiceSubscriptionId,
}: {
  client: SupabaseClient;
  orderId: string;
  requestSnapshot: ActivateExternalPlanPayload;
  responseSnapshot: unknown;
  plansServiceSubscriptionId: string | null;
}) {
  const { error } = await client
    .from('plan_subscription_orders')
    .update({
      status: 'active',
      payment_status: 'paid',
      plans_service_subscription_id: plansServiceSubscriptionId,
      request_snapshot: requestSnapshot,
      response_snapshot: responseSnapshot || {},
      activated_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
    })
    .eq('id', orderId);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PLAN_ORDER_ACTIVE_UPDATE_FAILED',
      message: 'Unable to mark plan order as active.',
      details: error.message,
    });
  }
}

async function markOrderActivationFailed({
  client,
  orderId,
  requestSnapshot,
  responseSnapshot,
  error,
}: {
  client: SupabaseClient;
  orderId: string;
  requestSnapshot: ActivateExternalPlanPayload | Record<string, unknown>;
  responseSnapshot: unknown;
  error: AppError;
}) {
  const { error: updateError } = await client
    .from('plan_subscription_orders')
    .update({
      status: 'activation_failed',
      payment_status: 'paid',
      request_snapshot: requestSnapshot,
      response_snapshot: responseSnapshot || {},
      error_code: error.code,
      error_message: error.message,
    })
    .eq('id', orderId);

  if (updateError) {
    throw new AppError({
      status: 500,
      code: 'PLAN_ORDER_ACTIVATION_FAILED_UPDATE_FAILED',
      message: 'Unable to record plan activation failure.',
      details: updateError.message,
    });
  }
}

export async function activatePlanSubscriptionForPayment(
  client: SupabaseClient,
  {
    paymentChargeId,
    requestId = '',
  }: {
    paymentChargeId: string;
    requestId?: string;
  },
): Promise<PlanActivationResult> {
  const charge = await loadPaymentCharge(client, paymentChargeId);

  if (charge.owner_type !== 'plan_subscription') {
    return {
      skipped: true,
      activated: false,
      orderId: charge.owner_id,
      paymentChargeId: charge.id,
      status: '',
      reason: 'owner_type_not_plan_subscription',
      plansServiceSubscriptionId: null,
    };
  }

  const order = await loadOrder(client, charge.owner_id);

  if (order.status === 'active') {
    return {
      skipped: true,
      activated: true,
      orderId: order.id,
      paymentChargeId: charge.id,
      status: 'active',
      reason: 'already_active',
      plansServiceSubscriptionId: null,
    };
  }

  if (charge.status !== 'paid') {
    return {
      skipped: true,
      activated: false,
      orderId: order.id,
      paymentChargeId: charge.id,
      status: order.status,
      reason: 'payment_not_paid',
      plansServiceSubscriptionId: null,
    };
  }

  if (order.payment_status !== 'paid') {
    const { error } = await client
      .from('plan_subscription_orders')
      .update({
        payment_status: 'paid',
        paid_at: charge.paid_at || order.paid_at || new Date().toISOString(),
        current_payment_charge_id: charge.id,
      })
      .eq('id', order.id);

    if (error) {
      throw new AppError({
        status: 500,
        code: 'PLAN_ORDER_PAYMENT_SYNC_FAILED',
        message: 'Unable to sync paid payment status before plan activation.',
        details: error.message,
      });
    }
  }

  let requestSnapshot: ActivateExternalPlanPayload | Record<string, unknown> = {};

  try {
    const appUserId = normalizeString(order.app_user_id || order.patient_id);

    if (!appUserId) {
      throw new AppError({
        status: 422,
        code: 'plan_activation_app_user_missing',
        message: 'Plan order does not have a linked patient.',
        details: { orderId: order.id },
      });
    }

    const appUser = await loadAppUser(client, appUserId);
    requestSnapshot = buildActivationPayload({ order, charge, appUser });

    await markOrderActivating({
      client,
      order,
      charge,
      requestSnapshot,
    });

    const response = await activateExternalPlanSubscription(requestSnapshot);

    await markOrderActive({
      client,
      orderId: order.id,
      requestSnapshot,
      responseSnapshot: response.raw,
      plansServiceSubscriptionId: response.subscriptionId,
    });

    console.info('[plans] activation:completed', {
      requestId,
      orderId: order.id,
      paymentChargeId: charge.id,
      planCode: order.plan_code,
      plansServiceSubscriptionId: response.subscriptionId,
    });

    return {
      skipped: false,
      activated: true,
      orderId: order.id,
      paymentChargeId: charge.id,
      status: 'active',
      reason: '',
      plansServiceSubscriptionId: response.subscriptionId,
    };
  } catch (error) {
    const appError = appErrorFromUnknown(error);
    const responseSnapshot = snapshotFromError(appError);

    await markOrderActivationFailed({
      client,
      orderId: order.id,
      requestSnapshot,
      responseSnapshot,
      error: appError,
    });

    console.warn('[plans] activation:failed', {
      requestId,
      orderId: order.id,
      paymentChargeId: charge.id,
      planCode: order.plan_code,
      code: appError.code,
      message: appError.message,
    });

    return {
      skipped: false,
      activated: false,
      orderId: order.id,
      paymentChargeId: charge.id,
      status: 'activation_failed',
      reason: 'activation_failed',
      plansServiceSubscriptionId: null,
      errorCode: appError.code,
      errorMessage: appError.message,
    };
  }
}
