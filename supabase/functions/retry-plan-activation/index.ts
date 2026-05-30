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
import { activatePlanSubscriptionForPayment } from '../_shared/plans/activate-plan-subscription.ts';
import { requireAppUserByAuthUserId, requireRole } from '../_shared/professional.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';

const FUNCTION_NAME = 'retry-plan-activation';
const CORS: CorsOptions = { allowedMethods: ['POST'] };

type RequestBody = {
  order_id?: string;
  orderId?: string;
};

type PlanSubscriptionOrderRow = {
  id: string;
  app_user_id: string | null;
  status: string;
  payment_status: string | null;
  current_payment_charge_id: string | null;
};

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function parseInput(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as RequestBody;
  const orderId = normalizeString(record.order_id || record.orderId);

  if (!orderId) {
    throw new AppError({
      status: 422,
      code: 'PLAN_ORDER_ID_REQUIRED',
      message: 'Plan order id is required.',
    });
  }

  return { orderId };
}

async function loadOrder(client: SupabaseClient, orderId: string) {
  const { data, error } = await client
    .from('plan_subscription_orders')
    .select('id, app_user_id, status, payment_status, current_payment_charge_id')
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PLAN_ORDER_LOOKUP_FAILED',
      message: 'Unable to load plan order for activation retry.',
      details: error.message,
    });
  }

  const order = data as PlanSubscriptionOrderRow | null;

  if (!order?.id) {
    throw new AppError({
      status: 404,
      code: 'PLAN_ORDER_NOT_FOUND',
      message: 'Plan order was not found.',
      details: { orderId },
    });
  }

  return order;
}

function assertRetryAllowed(order: PlanSubscriptionOrderRow) {
  if (order.payment_status !== 'paid') {
    throw new AppError({
      status: 409,
      code: 'PLAN_ORDER_PAYMENT_NOT_CONFIRMED',
      message: 'Plan activation can only be retried after payment is confirmed.',
      details: { orderId: order.id, paymentStatus: order.payment_status || '' },
    });
  }

  if (order.status !== 'activation_failed') {
    throw new AppError({
      status: 409,
      code: 'PLAN_ORDER_RETRY_NOT_ALLOWED',
      message: 'Plan activation retry is only allowed for failed activations.',
      details: { orderId: order.id, status: order.status },
    });
  }

  if (!order.current_payment_charge_id) {
    throw new AppError({
      status: 409,
      code: 'PLAN_ORDER_PAYMENT_CHARGE_REQUIRED',
      message: 'Plan order does not have a current payment charge.',
      details: { orderId: order.id },
    });
  }
}

export async function handleRetryPlanActivationRequest(req: Request) {
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
    const input = parseInput(await readJsonBody<unknown>(req));
    const client = createServiceRoleClient();
    const authenticatedUser = await requireAuthenticatedUser(req, createSupabaseAuthUserLookup(client));
    const appUser = await requireAppUserByAuthUserId(client, authenticatedUser.authUserId);

    requireRole(appUser, ['patient', 'admin']);

    const order = await loadOrder(client, input.orderId);

    if (appUser.role !== 'admin' && order.app_user_id !== appUser.id) {
      throw new AppError({
        status: 403,
        code: 'PLAN_ORDER_FORBIDDEN',
        message: 'You are not allowed to retry this plan activation.',
        details: { orderId: order.id },
      });
    }

    assertRetryAllowed(order);

    const activation = await activatePlanSubscriptionForPayment(client, {
      paymentChargeId: order.current_payment_charge_id as string,
      requestId,
    });

    return successResponse({ activation }, requestId, { status: 200, cors: CORS });
  } catch (error) {
    return errorResponse(error, {
      requestId,
      functionName: FUNCTION_NAME,
      cors: CORS,
    });
  }
}

export const retryPlanActivationHandler = (req: Request) => handleRetryPlanActivationRequest(req);

Deno.serve(retryPlanActivationHandler);
