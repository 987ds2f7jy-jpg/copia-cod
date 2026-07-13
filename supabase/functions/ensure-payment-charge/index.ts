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
import type { CreatedPaymentCharge, PaymentOwnerType } from '../_shared/payments/types.ts';
import { requireAppUserByAuthUserId, requireRole } from '../_shared/professional.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';

const FUNCTION_NAME = 'ensure-payment-charge';
const CORS: CorsOptions = { allowedMethods: ['POST'] };

type RequestBody = {
  ownerType?: PaymentOwnerType;
  ownerId?: string;
};

type OwnerConfig = {
  table: string;
  ownerField: string;
  amountField: string;
  coverageAware?: boolean;
};

type OwnerRow = {
  id: string;
  current_payment_charge_id: string | null;
  payment_status: string | null;
  payment_required: boolean | null;
  funding_source?: string | null;
  [key: string]: unknown;
};

type PaymentChargeRow = {
  id: string;
  status: string;
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

const OWNER_CONFIG: Record<PaymentOwnerType, OwnerConfig> = {
  appointment: {
    table: 'appointments',
    ownerField: 'patient_id',
    amountField: 'gross_price',
    coverageAware: true,
  },
  queue: {
    table: 'queues',
    ownerField: 'patient_id',
    amountField: 'quoted_gross_price',
    coverageAware: true,
  },
  solicitacao_exame: {
    table: 'solicitacoes_exames',
    ownerField: 'paciente_id',
    amountField: 'quoted_gross_price',
  },
  plan_subscription: {
    table: 'plan_subscription_orders',
    ownerField: 'app_user_id',
    amountField: 'amount',
  },
};

function normalizeOwnerType(value: unknown): PaymentOwnerType {
  const normalized = String(value || '').trim();

  if (
    normalized === 'appointment' ||
    normalized === 'queue' ||
    normalized === 'solicitacao_exame' ||
    normalized === 'plan_subscription'
  ) {
    return normalized;
  }

  throw new AppError({
    status: 422,
    code: 'PAYMENT_OWNER_TYPE_INVALID',
    message: 'Payment owner type is invalid.',
    details: { ownerType: value },
  });
}

function parseMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : 0;
}

function mapChargeRow(row: PaymentChargeRow): CreatedPaymentCharge {
  return {
    paymentChargeId: row.id,
    externalReference: String(row.external_reference || ''),
    providerIdempotencyKey: String(row.provider_idempotency_key || ''),
    provider: String(row.provider || ''),
    providerChargeId: String(row.provider_charge_id || ''),
    checkoutUrl: String(row.provider_checkout_url || ''),
    paymentReference: String(row.provider_payment_reference || ''),
    status: row.status as CreatedPaymentCharge['status'],
    attemptNumber: Number(row.attempt_number || 1),
    amount: parseMoney(row.amount),
    currency: String(row.currency || 'BRL'),
    paidAt: row.paid_at || null,
    reusedExisting: true,
  };
}

async function loadOwner(
  client: SupabaseClient,
  ownerType: PaymentOwnerType,
  ownerId: string,
  patientId: string,
) {
  const config = OWNER_CONFIG[ownerType];
  const coverageFields = config.coverageAware ? ', funding_source, coverage_status' : '';
  const { data, error } = await client
    .from(config.table)
    .select(`id, ${config.ownerField}, ${config.amountField}, payment_status, payment_required, current_payment_charge_id${coverageFields}`)
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

  const row = data as OwnerRow | null;

  if (!row?.id) {
    throw new AppError({
      status: 404,
      code: 'PAYMENT_OWNER_NOT_FOUND',
      message: 'Payment owner was not found.',
      details: { ownerType, ownerId },
    });
  }

  if (String(row[config.ownerField] || '') !== patientId) {
    throw new AppError({
      status: 403,
      code: 'PAYMENT_OWNER_FORBIDDEN',
      message: 'You are not allowed to access this payment owner.',
      details: { ownerType, ownerId },
    });
  }

  if (row.payment_required === false || (config.coverageAware && row.funding_source === 'plan')) {
    throw new AppError({
      status: 409,
      code: 'PAYMENT_NOT_REQUIRED_FOR_COVERED_OWNER',
      message: 'A one-off payment charge cannot be created for a plan-funded owner.',
      details: { ownerType, ownerId },
    });
  }

  const amount = parseMoney(row[config.amountField]);

  if (amount <= 0) {
    throw new AppError({
      status: 409,
      code: 'PAYMENT_OWNER_SNAPSHOT_INVALID',
      message: 'Payment owner does not have a valid financial snapshot.',
      details: { ownerType, ownerId },
    });
  }

  return {
    row,
    amount,
  };
}

async function loadChargeById(client: SupabaseClient, chargeId: string) {
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
    .eq('id', chargeId)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_CHARGE_LOOKUP_FAILED',
      message: 'Unable to load payment charge.',
      details: error.message,
    });
  }

  return (data as PaymentChargeRow | null) || null;
}

async function loadLatestCharge(
  client: SupabaseClient,
  ownerType: PaymentOwnerType,
  ownerId: string,
) {
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
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .order('attempt_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_CHARGE_LOOKUP_FAILED',
      message: 'Unable to load the latest payment charge.',
      details: error.message,
    });
  }

  return (data as PaymentChargeRow | null) || null;
}

async function ensurePaymentCharge({
  client,
  ownerType,
  ownerId,
  patientId,
}: {
  client: SupabaseClient;
  ownerType: PaymentOwnerType;
  ownerId: string;
  patientId: string;
}) {
  const owner = await loadOwner(client, ownerType, ownerId, patientId);

  if (owner.row.payment_status === 'paid') {
    const existingCharge = owner.row.current_payment_charge_id
      ? await loadChargeById(client, owner.row.current_payment_charge_id)
      : await loadLatestCharge(client, ownerType, ownerId);

    if (!existingCharge?.id) {
      throw new AppError({
        status: 409,
        code: 'PAYMENT_CHARGE_NOT_FOUND',
        message: 'Paid payment owner does not have a persisted payment charge.',
        details: { ownerType, ownerId },
      });
    }

    return mapChargeRow(existingCharge);
  }

  return createPaymentCharge(client, {
    ownerType,
    ownerId,
    amount: owner.amount,
    currency: 'BRL',
  });
}

export async function handleEnsurePaymentChargeRequest(req: Request) {
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
    const body = await readJsonBody<RequestBody>(req);
    const ownerType = normalizeOwnerType(body?.ownerType);
    const ownerId = String(body?.ownerId || '').trim();

    if (!ownerId) {
      throw new AppError({
        status: 422,
        code: 'PAYMENT_OWNER_ID_REQUIRED',
        message: 'Payment owner id is required.',
      });
    }

    const client = createServiceRoleClient();
    const authenticatedUser = await requireAuthenticatedUser(req, createSupabaseAuthUserLookup(client));
    const appUser = await requireAppUserByAuthUserId(client, authenticatedUser.authUserId);

    requireRole(appUser, ['patient']);

    const payment = await ensurePaymentCharge({
      client,
      ownerType,
      ownerId,
      patientId: appUser.id,
    });

    return successResponse({ payment }, requestId, { status: 200, cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
}

Deno.serve(handleEnsurePaymentChargeRequest);
