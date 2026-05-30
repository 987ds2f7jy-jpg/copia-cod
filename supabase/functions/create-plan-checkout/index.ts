import { requireAuthenticatedUser } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import {
  createRequestId,
  ensureMethod,
  errorResponse,
  handlePreflight,
  readJsonBody,
  successResponse,
} from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { createPaymentCharge } from '../_shared/payments/create-payment-charge.ts';
import type { CreatedPaymentCharge } from '../_shared/payments/types.ts';
import { resolvePlanCatalogEntry, type PlanCatalogEntry } from '../_shared/plans/plan-catalog.ts';
import { requireAppUserByAuthUserId, requireRole, type AppUser } from '../_shared/professional.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';

const FUNCTION_NAME = 'create-plan-checkout';
const CORS: CorsOptions = { allowedMethods: ['POST'] };

const OPEN_ORDER_STATUSES = [
  'pending_payment',
  'payment_confirmed',
  'activating_plan',
  'active',
  'activation_failed',
];

type RequestBody = {
  plan_code?: string;
  planCode?: string;
};

type PlanSubscriptionOrderRow = {
  id: string;
  patient_id: string | null;
  app_user_id: string | null;
  plan_code: string;
  external_plan_id: number | string | null;
  amount: number | string;
  currency: string;
  status: string;
  payment_status: string | null;
  payment_required: boolean | null;
  current_payment_charge_id: string | null;
  plans_service_subscription_id: string | null;
  external_key: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type PaymentChargeRow = {
  id: string;
  status: CreatedPaymentCharge['status'];
  attempt_number: number | null;
  provider: string | null;
  amount: number | string | null;
  currency: string | null;
  external_reference: string | null;
  provider_idempotency_key: string | null;
  provider_charge_id: string | null;
  provider_checkout_url: string | null;
  provider_payment_reference: string | null;
  paid_at: string | null;
};

function parseMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : 0;
}

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeInput(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as RequestBody;
  const plan = resolvePlanCatalogEntry(record.plan_code || record.planCode);

  return { plan };
}

function mapOrder(row: PlanSubscriptionOrderRow, plan: PlanCatalogEntry) {
  return {
    id: row.id,
    patientId: row.patient_id,
    appUserId: row.app_user_id,
    planCode: row.plan_code,
    planLabel: plan.label,
    externalPlanId: Number(row.external_plan_id || plan.externalPlanId),
    amount: parseMoney(row.amount),
    currency: row.currency || plan.currency,
    status: row.status,
    paymentStatus: row.payment_status,
    paymentRequired: Boolean(row.payment_required ?? true),
    currentPaymentChargeId: row.current_payment_charge_id,
    plansServiceSubscriptionId: row.plans_service_subscription_id,
    externalKey: row.external_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapChargeRow(row: PaymentChargeRow): CreatedPaymentCharge {
  return {
    paymentChargeId: row.id,
    externalReference: normalizeString(row.external_reference),
    providerIdempotencyKey: normalizeString(row.provider_idempotency_key),
    provider: normalizeString(row.provider),
    providerChargeId: normalizeString(row.provider_charge_id),
    checkoutUrl: normalizeString(row.provider_checkout_url),
    paymentReference: normalizeString(row.provider_payment_reference),
    status: row.status,
    attemptNumber: Number(row.attempt_number || 1),
    amount: parseMoney(row.amount),
    currency: normalizeString(row.currency) || 'BRL',
    paidAt: row.paid_at || null,
    reusedExisting: true,
  };
}

async function loadCurrentPaymentCharge(client: SupabaseClient, paymentChargeId: string) {
  const { data, error } = await client
    .from('payment_charges')
    .select(`
      id,
      status,
      attempt_number,
      provider,
      amount,
      currency,
      external_reference,
      provider_idempotency_key,
      provider_charge_id,
      provider_checkout_url,
      provider_payment_reference,
      paid_at
    `)
    .eq('id', paymentChargeId)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_CHARGE_LOOKUP_FAILED',
      message: 'Unable to load plan checkout charge.',
      details: error.message,
    });
  }

  return data ? mapChargeRow(data as PaymentChargeRow) : null;
}

async function loadOpenOrder(
  client: SupabaseClient,
  appUserId: string,
  planCode: string,
) {
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
      payment_required,
      current_payment_charge_id,
      plans_service_subscription_id,
      external_key,
      created_at,
      updated_at
    `)
    .eq('app_user_id', appUserId)
    .eq('plan_code', planCode)
    .in('status', OPEN_ORDER_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PLAN_ORDER_LOOKUP_FAILED',
      message: 'Unable to load existing plan order.',
      details: error.message,
    });
  }

  return (data as PlanSubscriptionOrderRow | null) || null;
}

function assertOrderMatchesPlan(order: PlanSubscriptionOrderRow, plan: PlanCatalogEntry) {
  const orderAmount = parseMoney(order.amount);
  const orderCurrency = normalizeString(order.currency).toUpperCase();
  const orderExternalPlanId = Number(order.external_plan_id || 0);

  if (
    orderAmount !== plan.amount ||
    orderCurrency !== plan.currency ||
    orderExternalPlanId !== plan.externalPlanId
  ) {
    throw new AppError({
      status: 409,
      code: 'PLAN_ORDER_SNAPSHOT_STALE',
      message: 'Existing plan order does not match the current backend plan catalog.',
      details: {
        orderId: order.id,
        planCode: plan.code,
        orderAmount,
        currentAmount: plan.amount,
        orderCurrency,
        currentCurrency: plan.currency,
        orderExternalPlanId,
        currentExternalPlanId: plan.externalPlanId,
      },
    });
  }
}

function assertOrderCanCheckout(order: PlanSubscriptionOrderRow) {
  if (order.status === 'active') {
    throw new AppError({
      status: 409,
      code: 'PLAN_ORDER_ALREADY_ACTIVE',
      message: 'This plan is already active for the patient.',
      details: { orderId: order.id, planCode: order.plan_code },
    });
  }
}

async function insertPlanOrder({
  client,
  appUser,
  externalKey,
  plan,
}: {
  client: SupabaseClient;
  appUser: AppUser;
  externalKey: string;
  plan: PlanCatalogEntry;
}) {
  const requestSnapshot = {
    source: 'rapido_doutor',
    plan: {
      code: plan.code,
      label: plan.label,
      external_plan_id: plan.externalPlanId,
      amount: plan.amount,
      currency: plan.currency,
    },
    customer: {
      app_user_id: appUser.id,
      email: appUser.email,
      full_name: appUser.fullName,
    },
  };

  const { data, error } = await client
    .from('plan_subscription_orders')
    .insert({
      patient_id: appUser.id,
      app_user_id: appUser.id,
      plan_code: plan.code,
      external_plan_id: plan.externalPlanId,
      amount: plan.amount,
      currency: plan.currency,
      status: 'pending_payment',
      payment_status: 'payment_pending',
      payment_required: true,
      external_key: externalKey,
      request_snapshot: requestSnapshot,
    })
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
      payment_required,
      current_payment_charge_id,
      plans_service_subscription_id,
      external_key,
      created_at,
      updated_at
    `)
    .single();

  if (error) {
    const existing = await loadOpenOrder(client, appUser.id, plan.code);

    if (existing?.id) {
      return existing;
    }

    throw new AppError({
      status: 500,
      code: 'PLAN_ORDER_CREATE_FAILED',
      message: 'Unable to create plan subscription order.',
      details: error.message,
    });
  }

  return data as PlanSubscriptionOrderRow;
}

async function loadOrCreatePlanOrder({
  client,
  appUser,
  externalKey,
  plan,
}: {
  client: SupabaseClient;
  appUser: AppUser;
  externalKey: string;
  plan: PlanCatalogEntry;
}) {
  const existing = await loadOpenOrder(client, appUser.id, plan.code);

  if (existing?.id) {
    assertOrderMatchesPlan(existing, plan);
    assertOrderCanCheckout(existing);
    return {
      order: existing,
      reusedExisting: true,
    };
  }

  const order = await insertPlanOrder({ client, appUser, externalKey, plan });
  assertOrderMatchesPlan(order, plan);
  assertOrderCanCheckout(order);

  return {
    order,
    reusedExisting: false,
  };
}

async function createPlanCheckout({
  client,
  appUser,
  plan,
}: {
  client: SupabaseClient;
  appUser: AppUser;
  plan: PlanCatalogEntry;
}) {
  const externalKey = normalizeString(appUser.email);

  if (!externalKey) {
    throw new AppError({
      status: 422,
      code: 'PLAN_EXTERNAL_KEY_REQUIRED',
      message: 'Patient email is required to create a plan checkout.',
    });
  }

  const { order, reusedExisting } = await loadOrCreatePlanOrder({
    client,
    appUser,
    externalKey,
    plan,
  });

  let payment: CreatedPaymentCharge | null = null;

  if (order.payment_status === 'paid' && order.current_payment_charge_id) {
    payment = await loadCurrentPaymentCharge(client, order.current_payment_charge_id);
  }

  if (!payment) {
    payment = await createPaymentCharge(client, {
      ownerType: 'plan_subscription',
      ownerId: order.id,
      amount: plan.amount,
      currency: plan.currency,
    });
  }

  const responseOrder = {
    ...order,
    current_payment_charge_id: payment.paymentChargeId,
    payment_status: payment.status,
    paid_at: payment.paidAt || null,
  };

  return {
    order: mapOrder(responseOrder, plan),
    payment,
    checkoutUrl: payment.checkoutUrl,
    reusedExistingOrder: reusedExisting,
  };
}

export async function handleCreatePlanCheckoutRequest(req: Request) {
  const preflightResponse = handlePreflight(req, CORS);

  if (preflightResponse) {
    return preflightResponse;
  }

  const requestId = createRequestId();
  const methodErrorResponse = ensureMethod(req, {
    allowedMethods: ['POST'],
    functionName: FUNCTION_NAME,
    requestId,
    cors: CORS,
  });

  if (methodErrorResponse) {
    return methodErrorResponse;
  }

  try {
    const input = normalizeInput(await readJsonBody<unknown>(req));
    const client = createServiceRoleClient();
    const authenticatedUser = await requireAuthenticatedUser(req, createSupabaseAuthUserLookup(client));
    const appUser = await requireAppUserByAuthUserId(client, authenticatedUser.authUserId);

    requireRole(appUser, ['patient']);

    const checkout = await createPlanCheckout({
      client,
      appUser,
      plan: input.plan,
    });

    console.info('[create-plan-checkout] checkout:created', {
      requestId,
      appUserId: appUser.id,
      planCode: input.plan.code,
      orderId: checkout.order.id,
      paymentChargeId: checkout.payment?.paymentChargeId,
      reusedExistingOrder: checkout.reusedExistingOrder,
      provider: checkout.payment?.provider,
    });

    return successResponse(checkout, requestId, { status: 200, cors: CORS });
  } catch (error) {
    return errorResponse(error, {
      requestId,
      functionName: FUNCTION_NAME,
      cors: CORS,
    });
  }
}

export const createPlanCheckoutHandler = (req: Request) => handleCreatePlanCheckoutRequest(req);

Deno.serve(createPlanCheckoutHandler);
