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
import { markPaymentAsPaid } from '../_shared/payments/mark-payment-as-paid.ts';
import type { PaymentOwnerType } from '../_shared/payments/types.ts';
import {
  createServiceRoleClient,
  type SupabaseClient,
} from '../_shared/supabase.ts';

const FUNCTION_NAME = 'simulate-payment-paid';
const CORS: CorsOptions = {
  allowedMethods: ['POST'],
  allowedHeaders: ['x-payment-simulation-secret'],
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

function assertSimulationEnabled(req: Request) {
  const enabled = normalizeString(Deno.env.get('ENABLE_PAYMENT_SIMULATION')).toLowerCase() === 'true';

  if (!enabled) {
    throw new AppError({
      status: 403,
      code: 'PAYMENT_SIMULATION_DISABLED',
      message: 'Payment simulation is disabled for this environment.',
    });
  }

  const expectedSecret = normalizeString(Deno.env.get('PAYMENT_SIMULATION_SECRET'));

  if (!expectedSecret) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_SIMULATION_SECRET_NOT_CONFIGURED',
      message: 'Payment simulation requires PAYMENT_SIMULATION_SECRET.',
    });
  }

  const providedSecret = normalizeString(req.headers.get('x-payment-simulation-secret'));

  if (!providedSecret || providedSecret !== expectedSecret) {
    throw new AppError({
      status: 403,
      code: 'PAYMENT_SIMULATION_FORBIDDEN',
      message: 'Payment simulation secret is invalid.',
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
    assertSimulationEnabled(req);

    const input = parseInput(await readJsonBody<unknown>(req));
    const client = createServiceRoleClient();
    const paymentChargeId = input.paymentChargeId ||
      await findCurrentPaymentChargeId(client, input.ownerType as PaymentOwnerType, input.ownerId);
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
