import { AppError } from '../errors.ts';
import type { SupabaseClient } from '../supabase.ts';
import { createPaymentProvider } from './providers/index.ts';
import type { ProviderCreateChargeResult } from './providers/types.ts';
import type {
  CreatedPaymentCharge,
  CreatePaymentChargeInput,
  PaymentChargeStatus,
  PaymentOwnerType,
} from './types.ts';

type OwnerConfig = {
  table: string;
  amountField: string;
};

type OwnerSnapshotRow = {
  id: string;
  payment_status: string | null;
  current_payment_charge_id: string | null;
  [key: string]: unknown;
};

type PaymentChargeRow = {
  id: string;
  status: PaymentChargeStatus;
  attempt_number: number;
  provider: string;
  amount: number | string;
  currency: string;
  external_reference: string;
  provider_idempotency_key: string;
  provider_charge_id: string;
  provider_checkout_url: string;
  provider_payment_reference: string;
};

const OWNER_CONFIG: Record<PaymentOwnerType, OwnerConfig> = {
  appointment: {
    table: 'appointments',
    amountField: 'gross_price',
  },
  queue: {
    table: 'queues',
    amountField: 'quoted_gross_price',
  },
  solicitacao_exame: {
    table: 'solicitacoes_exames',
    amountField: 'quoted_gross_price',
  },
  plan_subscription: {
    table: 'plan_subscription_orders',
    amountField: 'amount',
  },
};

const RETRYABLE_STATUSES = new Set<PaymentChargeStatus>([
  'payment_failed',
  'payment_expired',
]);

const REUSABLE_STATUSES = new Set<PaymentChargeStatus>([
  'payment_pending',
  'payment_processing',
]);

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? roundMoney(parsed) : 0;
}

function normalizeCurrency(currency: string | undefined) {
  const normalized = (currency || 'BRL').trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new AppError({
      status: 422,
      code: 'PAYMENT_CURRENCY_INVALID',
      message: 'Payment currency must be a valid 3-letter ISO code.',
      details: { currency },
    });
  }

  return normalized;
}

function buildSelect(config: OwnerConfig) {
  return `id, ${config.amountField}, payment_status, current_payment_charge_id`;
}

async function loadOwnerSnapshot(
  client: SupabaseClient,
  ownerType: PaymentOwnerType,
  ownerId: string,
) {
  const config = OWNER_CONFIG[ownerType];
  const { data, error } = await client
    .from(config.table)
    .select(buildSelect(config))
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

  const row = data as OwnerSnapshotRow | null;

  if (!row?.id) {
    throw new AppError({
      status: 404,
      code: 'PAYMENT_OWNER_NOT_FOUND',
      message: 'Payment owner was not found.',
      details: { ownerType, ownerId },
    });
  }

  const snapshotAmount = parseMoney(row[config.amountField]);

  if (snapshotAmount <= 0) {
    throw new AppError({
      status: 409,
      code: 'PAYMENT_OWNER_SNAPSHOT_INVALID',
      message: 'Payment owner does not have a valid financial snapshot.',
      details: { ownerType, ownerId, amountField: config.amountField },
    });
  }

  return {
    row,
    snapshotAmount,
    config,
  };
}

async function loadExistingCharges(
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
      provider_payment_reference
    `)
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .order('attempt_number', { ascending: false });

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_CHARGES_LOOKUP_FAILED',
      message: 'Unable to load payment charge attempts.',
      details: error.message,
    });
  }

  return (data || []) as PaymentChargeRow[];
}

async function updateOwnerPaymentState(
  client: SupabaseClient,
  ownerType: PaymentOwnerType,
  ownerId: string,
  paymentChargeId: string,
  paymentStatus: PaymentChargeStatus,
) {
  const config = OWNER_CONFIG[ownerType];
  const { error } = await client
    .from(config.table)
    .update({
      current_payment_charge_id: paymentChargeId,
      payment_status: paymentStatus,
    })
    .eq('id', ownerId);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_OWNER_CHARGE_ATTACH_FAILED',
      message: 'Unable to attach payment charge to owner.',
      details: error.message,
    });
  }
}

function mapChargeRow(row: PaymentChargeRow, reusedExisting: boolean): CreatedPaymentCharge {
  return {
    paymentChargeId: row.id,
    externalReference: row.external_reference,
    providerIdempotencyKey: row.provider_idempotency_key,
    provider: row.provider,
    providerChargeId: row.provider_charge_id,
    checkoutUrl: row.provider_checkout_url,
    paymentReference: row.provider_payment_reference,
    status: row.status,
    attemptNumber: Number(row.attempt_number || 1),
    amount: parseMoney(row.amount),
    currency: String(row.currency || 'BRL'),
    reusedExisting,
  };
}

function resolveProviderCreatedStatus(provider: string) {
  if (provider === 'mock') {
    return 'mock_created';
  }

  if (provider === 'stripe') {
    return 'checkout_session_created';
  }

  return 'preference_created';
}

export async function createPaymentCharge(
  client: SupabaseClient,
  input: CreatePaymentChargeInput,
): Promise<CreatedPaymentCharge> {
  const ownerType = input.ownerType;
  const ownerId = input.ownerId;
  const currency = normalizeCurrency(input.currency);
  const amount = parseMoney(input.amount);
  const paymentProvider = createPaymentProvider(input.provider);
  const provider = paymentProvider.name;

  if (amount <= 0) {
    throw new AppError({
      status: 422,
      code: 'PAYMENT_CHARGE_AMOUNT_INVALID',
      message: 'Payment charge amount must be greater than zero.',
      details: { ownerType, ownerId, amount: input.amount },
    });
  }

  const owner = await loadOwnerSnapshot(client, ownerType, ownerId);

  if (owner.snapshotAmount !== amount) {
    throw new AppError({
      status: 409,
      code: 'PAYMENT_CHARGE_AMOUNT_MISMATCH',
      message: 'Payment charge amount must match the owner financial snapshot.',
      details: {
        ownerType,
        ownerId,
        snapshotAmount: owner.snapshotAmount,
        requestedAmount: amount,
      },
    });
  }

  if (owner.row.payment_status === 'paid') {
    throw new AppError({
      status: 409,
      code: 'PAYMENT_OWNER_ALREADY_PAID',
      message: 'Payment owner is already paid.',
      details: { ownerType, ownerId },
    });
  }

  const existingCharges = await loadExistingCharges(client, ownerType, ownerId);
  const paidCharge = existingCharges.find((charge) => charge.status === 'paid');

  if (paidCharge) {
    throw new AppError({
      status: 409,
      code: 'PAYMENT_CHARGE_ALREADY_PAID',
      message: 'A paid charge already exists for this owner.',
      details: { ownerType, ownerId, paymentChargeId: paidCharge.id },
    });
  }

  const latestCharge = existingCharges[0] || null;

  if (latestCharge && REUSABLE_STATUSES.has(latestCharge.status)) {
    const latestAmount = parseMoney(latestCharge.amount);
    const latestProvider = String(latestCharge.provider || '').trim();
    const providerIsCompatible = latestProvider === provider ||
      (provider === 'mock' && latestProvider === 'internal_simulated');

    if (latestAmount !== amount || latestCharge.currency !== currency) {
      throw new AppError({
        status: 409,
        code: 'PAYMENT_EXISTING_CHARGE_MISMATCH',
        message: 'Existing pending charge does not match the owner financial snapshot.',
        details: {
          ownerType,
          ownerId,
          existingAmount: latestAmount,
          requestedAmount: amount,
          existingCurrency: latestCharge.currency,
          requestedCurrency: currency,
        },
      });
    }

    if (!providerIsCompatible) {
      throw new AppError({
        status: 409,
        code: 'PAYMENT_EXISTING_CHARGE_PROVIDER_MISMATCH',
        message: 'Existing pending charge belongs to a different payment provider.',
        details: {
          ownerType,
          ownerId,
          existingProvider: latestProvider,
          requestedProvider: provider,
        },
      });
    }

    await updateOwnerPaymentState(client, ownerType, ownerId, latestCharge.id, latestCharge.status);
    return mapChargeRow(latestCharge, true);
  }

  if (latestCharge && !RETRYABLE_STATUSES.has(latestCharge.status)) {
    throw new AppError({
      status: 409,
      code: 'PAYMENT_CHARGE_RETRY_NOT_ALLOWED',
      message: 'Current payment charge status does not allow creating a new attempt.',
      details: { ownerType, ownerId, status: latestCharge.status },
    });
  }

  const attemptNumber = latestCharge ? Number(latestCharge.attempt_number || 0) + 1 : 1;
  const token = crypto.randomUUID();
  const externalReference = `${ownerType}_${ownerId}_${attemptNumber}_${token}`;
  const providerIdempotencyKey = `${ownerType}:${ownerId}:${attemptNumber}:${token}`;

  const { data, error } = await client
    .from('payment_charges')
    .insert({
      owner_type: ownerType,
      owner_id: ownerId,
      attempt_number: attemptNumber,
      provider,
      status: 'payment_pending',
      amount,
      currency,
      external_reference: externalReference,
      provider_idempotency_key: providerIdempotencyKey,
      metadata: {
        provider,
        source: 'createPaymentCharge',
      },
    })
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
      provider_payment_reference
    `)
    .single();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_CHARGE_CREATE_FAILED',
      message: 'Unable to create payment charge.',
      details: error.message,
    });
  }

  const charge = data as PaymentChargeRow | null;

  if (!charge?.id) {
    throw new AppError({
      status: 500,
      code: 'INVALID_PAYMENT_CHARGE_RESPONSE',
      message: 'Payment charge creation returned an invalid response.',
    });
  }

  await updateOwnerPaymentState(client, ownerType, ownerId, charge.id, 'payment_pending');

  let providerResult: ProviderCreateChargeResult | null = null;

  try {
    providerResult = await paymentProvider.createCharge({
      internalChargeId: charge.id,
      ownerType,
      ownerId,
      attemptNumber,
      amount,
      currency,
      externalReference,
      idempotencyKey: providerIdempotencyKey,
    });
  } catch (error) {
    const failureMessage = error instanceof Error ? error.message : 'Payment provider charge creation failed.';

    await client
      .from('payment_charges')
      .update({
        status: 'payment_failed',
        failed_at: new Date().toISOString(),
        failure_reason: failureMessage,
        last_provider_status: 'create_failed',
        last_provider_payload: {
          error: failureMessage,
        },
      })
      .eq('id', charge.id);

    await updateOwnerPaymentState(client, ownerType, ownerId, charge.id, 'payment_failed');

    console.error('[payments] charge:create-failed', {
      ownerType,
      ownerId,
      paymentChargeId: charge.id,
      provider,
      error,
    });

    throw error;
  }

  if (!providerResult) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_PROVIDER_RESPONSE_MISSING',
      message: 'Payment provider did not return a charge response.',
    });
  }

  const { data: updatedCharge, error: updateChargeError } = await client
    .from('payment_charges')
    .update({
      provider: providerResult.provider,
      provider_charge_id: providerResult.providerChargeId,
      provider_checkout_url: providerResult.checkoutUrl,
      provider_payment_reference: providerResult.paymentReference,
      last_provider_status: resolveProviderCreatedStatus(providerResult.provider),
      last_provider_payload: providerResult.raw,
      metadata: {
        provider: providerResult.provider,
        source: 'createPaymentCharge',
        checkoutCreated: Boolean(providerResult.checkoutUrl),
      },
    })
    .eq('id', charge.id)
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
      provider_payment_reference
    `)
    .single();

  if (updateChargeError) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_PROVIDER_RESPONSE_SAVE_FAILED',
      message: 'Unable to persist payment provider response.',
      details: updateChargeError.message,
    });
  }

  console.info('[payments] charge:created', {
    ownerType,
    ownerId,
    paymentChargeId: charge.id,
    provider: providerResult.provider,
    providerChargeId: providerResult.providerChargeId,
    amount,
    currency,
  });

  return mapChargeRow(updatedCharge as PaymentChargeRow, false);
}
