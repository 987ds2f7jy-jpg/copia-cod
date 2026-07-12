import { AppError } from '../_shared/errors.ts';
import { requireAuthenticatedUser } from '../_shared/auth.ts';
import { findAppUserByAuthUserId } from '../_shared/appUsers.ts';
import {
  createRequestId,
  ensureMethod,
  errorResponse,
  handlePreflight,
  readJsonBody,
  successResponse,
} from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { markPaymentAsPaid } from '../_shared/payments/mark-payment-as-paid.ts';
import type { PaymentOwnerType } from '../_shared/payments/types.ts';
import { isLocalPaymentEnvironment, normalizeAppEnvironment } from '../_shared/payments/environment-policy.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';

const FUNCTION_NAME = 'simulate-payment-paid';
const CORS: CorsOptions = {
  allowedMethods: ['POST'],
};

type SimulatePaymentPaidInput = {
  paymentChargeId: string;
  ownerType: PaymentOwnerType | '';
  ownerId: string;
};

const OWNER_TABLE: Record<PaymentOwnerType, string> = {
  appointment: 'appointments',
  queue: 'queues',
  solicitacao_exame: 'solicitacoes_exames',
  plan_subscription: 'plan_subscription_orders',
};

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function parseInput(body: unknown): SimulatePaymentPaidInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const paymentChargeId = normalizeString(record.paymentChargeId || record.payment_charge_id);
  const ownerType = normalizeString(record.ownerType || record.owner_type) as PaymentOwnerType | '';
  const ownerId = normalizeString(record.ownerId || record.owner_id);

  if (paymentChargeId) {
    return {
      paymentChargeId,
      ownerType: '',
      ownerId: '',
    };
  }

  if (!ownerType || !OWNER_TABLE[ownerType]) {
    throw new AppError({
      status: 400,
      code: 'PAYMENT_OWNER_TYPE_INVALID',
      message: 'A valid ownerType is required when paymentChargeId is not provided.',
      details: { allowedOwnerTypes: Object.keys(OWNER_TABLE) },
    });
  }

  if (!ownerId) {
    throw new AppError({
      status: 400,
      code: 'PAYMENT_OWNER_ID_REQUIRED',
      message: 'ownerId is required when paymentChargeId is not provided.',
    });
  }

  return {
    paymentChargeId: '',
    ownerType,
    ownerId,
  };
}

function assertSimulationEnabled() {
  const environment = normalizeAppEnvironment(Deno.env.get('APP_ENV'));
  const enabled = normalizeString(Deno.env.get('ENABLE_PAYMENT_SIMULATION')).toLowerCase() === 'true';

  if (!isLocalPaymentEnvironment(environment) || !enabled) {
    throw new AppError({
      status: 403,
      code: 'PAYMENT_SIMULATION_DISABLED',
      message: 'Payment simulation is disabled for this environment.',
      details: { environment },
    });
  }
}

async function assertPaymentChargeOwnership(
  client: SupabaseClient,
  paymentChargeId: string,
  appUser: { id: string; role: string; isActive: boolean },
) {
  if (appUser.isActive === false) {
    throw new AppError({
      status: 403,
      code: 'ACCOUNT_INACTIVE',
      message: 'Authenticated account is inactive.',
    });
  }

  const { data: chargeData, error: chargeError } = await client
    .from('payment_charges')
    .select('id, owner_type, owner_id')
    .eq('id', paymentChargeId)
    .maybeSingle();

  if (chargeError) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_CHARGE_LOOKUP_FAILED',
      message: 'Unable to load payment charge for simulation.',
      details: chargeError.message,
    });
  }

  const charge = chargeData as { id: string; owner_type: PaymentOwnerType; owner_id: string } | null;

  if (!charge?.id || !OWNER_TABLE[charge.owner_type]) {
    throw new AppError({
      status: 404,
      code: 'PAYMENT_CHARGE_NOT_FOUND',
      message: 'Payment charge was not found.',
    });
  }

  if (appUser.role === 'admin') {
    return;
  }

  const ownerSelect = charge.owner_type === 'plan_subscription'
    ? 'id, app_user_id, patient_id'
    : 'id, patient_id';
  const { data: ownerData, error: ownerError } = await client
    .from(OWNER_TABLE[charge.owner_type])
    .select(ownerSelect)
    .eq('id', charge.owner_id)
    .maybeSingle();

  if (ownerError) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_OWNER_LOOKUP_FAILED',
      message: 'Unable to validate payment owner for simulation.',
      details: ownerError.message,
    });
  }

  const owner = ownerData as { id?: string; patient_id?: string | null; app_user_id?: string | null } | null;
  const ownerUserIds = new Set([
    normalizeString(owner?.patient_id),
    normalizeString(owner?.app_user_id),
  ].filter(Boolean));

  if (!owner?.id || !ownerUserIds.has(appUser.id)) {
    throw new AppError({
      status: 403,
      code: 'PAYMENT_SIMULATION_FORBIDDEN',
      message: 'Authenticated user cannot simulate this payment charge.',
    });
  }
}

async function findCurrentPaymentChargeId(
  client: SupabaseClient,
  ownerType: PaymentOwnerType,
  ownerId: string,
) {
  const { data, error } = await client
    .from(OWNER_TABLE[ownerType])
    .select('id, current_payment_charge_id, payment_status')
    .eq('id', ownerId)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_OWNER_LOOKUP_FAILED',
      message: 'Unable to load payment owner.',
      details: error.message,
    });
  }

  const row = data as {
    id: string;
    current_payment_charge_id: string | null;
    payment_status: string | null;
  } | null;

  if (!row?.id) {
    throw new AppError({
      status: 404,
      code: 'PAYMENT_OWNER_NOT_FOUND',
      message: 'Payment owner was not found.',
      details: { ownerType, ownerId },
    });
  }

  if (!row.current_payment_charge_id) {
    throw new AppError({
      status: 409,
      code: 'PAYMENT_CHARGE_REQUIRED',
      message: 'Payment owner does not have a current payment charge.',
      details: { ownerType, ownerId, paymentStatus: row.payment_status || '' },
    });
  }

  return row.current_payment_charge_id;
}

export async function handleSimulatePaymentPaidRequest(req: Request) {
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
    assertSimulationEnabled();

    const client = createServiceRoleClient();
    const authenticatedUser = await requireAuthenticatedUser(req, createSupabaseAuthUserLookup(client));
    const appUser = await findAppUserByAuthUserId(client, authenticatedUser.authUserId);

    if (!appUser?.id) {
      throw new AppError({
        status: 403,
        code: 'APP_USER_NOT_FOUND',
        message: 'Authenticated user is not linked to app_users.',
      });
    }

    const input = parseInput(await readJsonBody<unknown>(req));
    const paymentChargeId = input.paymentChargeId ||
      await findCurrentPaymentChargeId(client, input.ownerType as PaymentOwnerType, input.ownerId);
    await assertPaymentChargeOwnership(client, paymentChargeId, appUser);
    const result = await markPaymentAsPaid(client, { paymentChargeId });

    return successResponse(result, requestId, {
      status: 200,
      cors: CORS,
    });
  } catch (error) {
    return errorResponse(error, {
      requestId,
      functionName: FUNCTION_NAME,
      cors: CORS,
    });
  }
}
