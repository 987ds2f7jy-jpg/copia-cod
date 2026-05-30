import { AppError, isAppError } from '../_shared/errors.ts';
import {
  createRequestId,
  ensureMethod,
  errorResponse,
  handlePreflight,
  successResponse,
} from '../_shared/http.ts';
import {
  createPaymentProvider,
  getConfiguredPaymentProviderName,
} from '../_shared/payments/providers/index.ts';
import { activatePlanSubscriptionForPayment } from '../_shared/plans/activate-plan-subscription.ts';
import type {
  ProviderChargeStatusResult,
  ProviderWebhookVerificationResult,
} from '../_shared/payments/providers/types.ts';
import type { PaymentChargeStatus, PaymentOwnerType } from '../_shared/payments/types.ts';
import {
  createServiceRoleClient,
  type SupabaseClient,
} from '../_shared/supabase.ts';

const FUNCTION_NAME = 'payments-webhook';

type OwnerConfig = {
  table: string;
  amountField: string;
};

type PaymentChargeRow = {
  id: string;
  owner_type: PaymentOwnerType;
  owner_id: string;
  status: PaymentChargeStatus;
  provider: string;
  amount: number | string;
  currency: string;
  external_reference: string;
  provider_charge_id: string;
  provider_payment_reference: string;
  failure_reason: string;
};

type WebhookEventRow = {
  id: string;
  processed_at: string | null;
  processing_error: string;
  resolved_charge_id: string | null;
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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? roundMoney(parsed) : 0;
}

function safeParseJson(rawBody: string) {
  try {
    return rawBody ? JSON.parse(rawBody) as Record<string, unknown> : {};
  } catch {
    throw new AppError({
      status: 400,
      code: 'INVALID_JSON',
      message: 'Webhook body must be valid JSON.',
    });
  }
}

async function sha256Hex(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function buildPayload(req: Request, body: Record<string, unknown>) {
  const url = new URL(req.url);
  const hasLegacySignature = Boolean(req.headers.get('x-signature'));
  const hasStripeSignature = Boolean(req.headers.get('stripe-signature'));

  return {
    body,
    query: Object.fromEntries(url.searchParams.entries()),
    headers: {
      xRequestId: req.headers.get('x-request-id') || '',
      xSignaturePresent: hasLegacySignature || hasStripeSignature,
      stripeSignaturePresent: hasStripeSignature,
      userAgent: req.headers.get('user-agent') || '',
    },
  };
}

async function findExistingWebhookEvent(
  client: SupabaseClient,
  provider: string,
  eventHash: string,
  externalEventId: string,
) {
  const { data: byHash, error: hashError } = await client
    .from('payment_webhook_events')
    .select('id, processed_at, processing_error, resolved_charge_id')
    .eq('provider', provider)
    .eq('event_hash', eventHash)
    .maybeSingle();

  if (hashError) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_WEBHOOK_EVENT_LOOKUP_FAILED',
      message: 'Unable to check webhook event idempotency.',
      details: hashError.message,
    });
  }

  if (byHash) {
    return byHash as WebhookEventRow;
  }

  if (!externalEventId) {
    return null;
  }

  const { data: byExternalId, error: externalError } = await client
    .from('payment_webhook_events')
    .select('id, processed_at, processing_error, resolved_charge_id')
    .eq('provider', provider)
    .eq('external_event_id', externalEventId)
    .maybeSingle();

  if (externalError) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_WEBHOOK_EVENT_LOOKUP_FAILED',
      message: 'Unable to check webhook event idempotency.',
      details: externalError.message,
    });
  }

  return (byExternalId as WebhookEventRow | null) || null;
}

async function createOrLoadWebhookEvent({
  client,
  provider,
  verification,
  eventHash,
  payload,
}: {
  client: SupabaseClient;
  provider: string;
  verification: ProviderWebhookVerificationResult;
  eventHash: string;
  payload: Record<string, unknown>;
}) {
  const existing = await findExistingWebhookEvent(
    client,
    provider,
    eventHash,
    verification.eventId,
  );

  if (existing) {
    return {
      row: existing,
      duplicate: Boolean(existing.processed_at),
    };
  }

  const { data, error } = await client
    .from('payment_webhook_events')
    .insert({
      provider,
      external_event_id: verification.eventId,
      event_hash: eventHash,
      provider_charge_id: verification.providerChargeId,
      external_reference: verification.externalReference,
      event_type: verification.eventType,
      payload,
    })
    .select('id, processed_at, processing_error, resolved_charge_id')
    .single();

  if (error) {
    const loadedAfterConflict = await findExistingWebhookEvent(
      client,
      provider,
      eventHash,
      verification.eventId,
    );

    if (loadedAfterConflict) {
      return {
        row: loadedAfterConflict,
        duplicate: Boolean(loadedAfterConflict.processed_at),
      };
    }

    throw new AppError({
      status: 500,
      code: 'PAYMENT_WEBHOOK_EVENT_CREATE_FAILED',
      message: 'Unable to persist payment webhook event.',
      details: error.message,
    });
  }

  return {
    row: data as WebhookEventRow,
    duplicate: false,
  };
}

async function updateWebhookEvent(
  client: SupabaseClient,
  eventId: string,
  fields: Record<string, unknown>,
) {
  const { error } = await client
    .from('payment_webhook_events')
    .update(fields)
    .eq('id', eventId);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_WEBHOOK_EVENT_UPDATE_FAILED',
      message: 'Unable to update payment webhook event.',
      details: error.message,
    });
  }
}

async function resolvePaymentCharge(
  client: SupabaseClient,
  provider: string,
  status: ProviderChargeStatusResult,
) {
  const preferenceId = String((status.raw as { preference_id?: unknown }).preference_id || '').trim();

  const lookups = [
    status.externalReference
      ? { field: 'external_reference', value: status.externalReference }
      : null,
    status.paymentReference
      ? { field: 'provider_payment_reference', value: status.paymentReference }
      : null,
    status.providerChargeId
      ? { field: 'provider_payment_reference', value: status.providerChargeId }
      : null,
    status.providerChargeId
      ? { field: 'provider_charge_id', value: status.providerChargeId }
      : null,
    preferenceId
      ? { field: 'provider_charge_id', value: preferenceId }
      : null,
  ].filter(Boolean) as Array<{ field: string; value: string }>;

  for (const lookup of lookups) {
    const query = client
      .from('payment_charges')
      .select(`
        id,
        owner_type,
        owner_id,
        status,
        provider,
        amount,
        currency,
        external_reference,
        provider_charge_id,
        provider_payment_reference,
        failure_reason
      `)
      .eq(lookup.field, lookup.value);

    if (lookup.field !== 'external_reference') {
      query.eq('provider', provider);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new AppError({
        status: 500,
        code: 'PAYMENT_CHARGE_LOOKUP_FAILED',
        message: 'Unable to resolve payment charge from webhook.',
        details: error.message,
      });
    }

    const row = data as PaymentChargeRow | null;

    if (row?.id) {
      return row;
    }
  }

  throw new AppError({
    status: 404,
    code: 'PAYMENT_CHARGE_NOT_FOUND',
    message: 'Webhook payment charge was not found.',
    details: {
      provider,
      providerChargeId: status.providerChargeId,
      externalReference: status.externalReference,
      paymentReference: status.paymentReference,
    },
  });
}

async function loadOwnerSnapshotAmount(
  client: SupabaseClient,
  ownerType: PaymentOwnerType,
  ownerId: string,
) {
  const config = OWNER_CONFIG[ownerType];
  const { data, error } = await client
    .from(config.table)
    .select(`id, ${config.amountField}`)
    .eq('id', ownerId)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_OWNER_LOOKUP_FAILED',
      message: 'Unable to load payment owner during webhook processing.',
      details: error.message,
    });
  }

  const row = data as Record<string, unknown> | null;

  if (!row?.id) {
    throw new AppError({
      status: 404,
      code: 'PAYMENT_OWNER_NOT_FOUND',
      message: 'Payment owner was not found during webhook processing.',
      details: { ownerType, ownerId },
    });
  }

  return parseMoney(row[config.amountField]);
}

async function assertAmountsAreConsistent(
  client: SupabaseClient,
  charge: PaymentChargeRow,
  providerStatus: ProviderChargeStatusResult,
) {
  const chargeAmount = parseMoney(charge.amount);
  const providerAmount = parseMoney(providerStatus.amount);
  const ownerAmount = await loadOwnerSnapshotAmount(client, charge.owner_type, charge.owner_id);

  if (providerAmount <= 0) {
    throw new AppError({
      status: 409,
      code: 'PAYMENT_PROVIDER_AMOUNT_INVALID',
      message: 'Provider payment amount is invalid.',
      details: {
        paymentChargeId: charge.id,
        providerAmount,
      },
    });
  }

  if (providerAmount !== chargeAmount || ownerAmount !== chargeAmount) {
    throw new AppError({
      status: 409,
      code: 'PAYMENT_AMOUNT_MISMATCH',
      message: 'Provider amount, payment charge amount, and owner snapshot must match.',
      details: {
        paymentChargeId: charge.id,
        providerAmount,
        chargeAmount,
        ownerAmount,
      },
    });
  }

  const chargeCurrency = String(charge.currency || 'BRL').toUpperCase();
  const providerCurrency = String(providerStatus.currency || 'BRL').toUpperCase();

  if (providerCurrency !== chargeCurrency) {
    throw new AppError({
      status: 409,
      code: 'PAYMENT_CURRENCY_MISMATCH',
      message: 'Provider currency and payment charge currency must match.',
      details: {
        paymentChargeId: charge.id,
        providerCurrency,
        chargeCurrency,
      },
    });
  }
}

function shouldApplyTransition(current: PaymentChargeStatus, next: PaymentChargeStatus) {
  if (current === next) {
    return true;
  }

  if (current === 'chargeback') {
    return false;
  }

  if (current === 'refunded') {
    return next === 'chargeback';
  }

  if (current === 'paid') {
    return next === 'refunded' || next === 'chargeback';
  }

  if ((current === 'payment_failed' || current === 'payment_expired') &&
    (next === 'payment_pending' || next === 'payment_processing')) {
    return false;
  }

  return true;
}

function buildTimestampUpdates(status: PaymentChargeStatus, paidAt: string) {
  const now = new Date().toISOString();

  switch (status) {
    case 'paid':
      return { paid_at: paidAt || now };
    case 'payment_failed':
      return { failed_at: now };
    case 'payment_expired':
      return { expired_at: now };
    case 'refunded':
      return { refunded_at: now };
    case 'chargeback':
      return { chargeback_at: now };
    default:
      return {};
  }
}

async function updateOwnerPaymentStatus(
  client: SupabaseClient,
  charge: PaymentChargeRow,
  status: PaymentChargeStatus,
  paidAt: string,
) {
  const config = OWNER_CONFIG[charge.owner_type];
  const updatePayload: Record<string, unknown> = {
    payment_status: status,
    current_payment_charge_id: charge.id,
  };

  if (status === 'paid') {
    updatePayload.paid_at = paidAt || new Date().toISOString();

    if (charge.owner_type === 'plan_subscription') {
      updatePayload.status = 'payment_confirmed';
    }
  }

  if ((status === 'refunded' || status === 'chargeback') && charge.owner_type === 'plan_subscription') {
    updatePayload.status = 'refunded';
  }

  const { error } = await client
    .from(config.table)
    .update(updatePayload)
    .eq('id', charge.owner_id);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_OWNER_STATUS_UPDATE_FAILED',
      message: 'Unable to update payment owner status.',
      details: error.message,
    });
  }
}

async function applyProviderStatus({
  client,
  charge,
  providerStatus,
  requestId,
}: {
  client: SupabaseClient;
  charge: PaymentChargeRow;
  providerStatus: ProviderChargeStatusResult;
  requestId: string;
}) {
  await assertAmountsAreConsistent(client, charge, providerStatus);

  const nextStatus = providerStatus.status;

  if (!shouldApplyTransition(charge.status, nextStatus)) {
    return {
      applied: false,
      currentStatus: charge.status,
      nextStatus,
      reason: 'ignored_out_of_order_transition',
      activation: null,
    };
  }

  const paidAt = providerStatus.paidAt || new Date().toISOString();
  const chargeUpdate = {
    status: nextStatus,
    provider_payment_reference: providerStatus.paymentReference || charge.provider_payment_reference,
    last_provider_status: providerStatus.rawStatus,
    last_provider_payload: providerStatus.raw,
    failure_reason: providerStatus.failureReason || charge.failure_reason || '',
    ...buildTimestampUpdates(nextStatus, paidAt),
  };

  const { error } = await client
    .from('payment_charges')
    .update(chargeUpdate)
    .eq('id', charge.id);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_CHARGE_STATUS_UPDATE_FAILED',
      message: 'Unable to update payment charge status from webhook.',
      details: error.message,
    });
  }

  await updateOwnerPaymentStatus(client, charge, nextStatus, paidAt);

  const activation = charge.owner_type === 'plan_subscription' && nextStatus === 'paid'
    ? await activatePlanSubscriptionForPayment(client, {
      paymentChargeId: charge.id,
      requestId,
    })
    : null;

  console.info('[payments] webhook:status-applied', {
    paymentChargeId: charge.id,
    ownerType: charge.owner_type,
    ownerId: charge.owner_id,
    provider: providerStatus.provider,
    rawStatus: providerStatus.rawStatus,
    status: nextStatus,
  });

  return {
    applied: true,
    currentStatus: charge.status,
    nextStatus,
    reason: '',
    activation,
  };
}

function isNonRetryableProcessingError(error: unknown) {
  return isAppError(error) && [404, 409, 422].includes(error.status);
}

export async function handlePaymentsWebhookRequest(req: Request) {
  const preflightResponse = handlePreflight(req, {
    allowedMethods: ['POST'],
    allowedHeaders: ['x-signature', 'x-request-id', 'stripe-signature'],
  });

  if (preflightResponse) {
    return preflightResponse;
  }

  const requestId = createRequestId();
  const methodErrorResponse = ensureMethod(req, {
    allowedMethods: ['POST'],
    functionName: FUNCTION_NAME,
      requestId,
      cors: {
        allowedMethods: ['POST'],
        allowedHeaders: ['x-signature', 'x-request-id', 'stripe-signature'],
      },
    });

  if (methodErrorResponse) {
    return methodErrorResponse;
  }

  try {
    const providerName = getConfiguredPaymentProviderName();

    if (providerName === 'mock') {
      throw new AppError({
        status: 403,
        code: 'PAYMENT_WEBHOOK_PROVIDER_DISABLED',
        message: 'Real payment webhook is disabled while PAYMENT_PROVIDER is mock.',
      });
    }

    const provider = createPaymentProvider(providerName);
    const rawBody = await req.text();
    const body = safeParseJson(rawBody);
    const verification = await provider.verifyWebhook({ req, rawBody, body });
    const eventHash = await sha256Hex(`${provider.name}:${rawBody}`);
    const client = createServiceRoleClient();
    const event = await createOrLoadWebhookEvent({
      client,
      provider: provider.name,
      verification,
      eventHash,
      payload: buildPayload(req, body),
    });

    if (event.duplicate) {
      return successResponse({
        received: true,
        duplicate: true,
        processed: Boolean(event.row.processed_at),
        webhookEventId: event.row.id,
        paymentChargeId: event.row.resolved_charge_id,
      }, requestId);
    }

    try {
      const providerStatus = await provider.getChargeStatus(verification.providerChargeId);
      const charge = await resolvePaymentCharge(client, provider.name, providerStatus);
      const result = await applyProviderStatus({ client, charge, providerStatus, requestId });

      await updateWebhookEvent(client, event.row.id, {
        resolved_charge_id: charge.id,
        provider_charge_id: verification.providerChargeId,
        external_reference: providerStatus.externalReference || charge.external_reference,
        processed_at: new Date().toISOString(),
        processing_error: result.reason,
      });

      return successResponse({
        received: true,
        duplicate: false,
        processed: true,
        applied: result.applied,
        webhookEventId: event.row.id,
        paymentChargeId: charge.id,
        status: result.nextStatus,
        activation: result.activation,
      }, requestId);
    } catch (processingError) {
      if (isNonRetryableProcessingError(processingError)) {
        const appError = processingError as AppError;

        await updateWebhookEvent(client, event.row.id, {
          processed_at: new Date().toISOString(),
          processing_error: `${appError.code}: ${appError.message}`,
        });

        console.error('[payments] webhook:non-retryable-error', {
          requestId,
          webhookEventId: event.row.id,
          code: appError.code,
          details: appError.details,
        });

        return successResponse({
          received: true,
          duplicate: false,
          processed: false,
          webhookEventId: event.row.id,
          error: {
            code: appError.code,
            message: appError.message,
          },
        }, requestId);
      }

      await updateWebhookEvent(client, event.row.id, {
        processing_error: processingError instanceof Error
          ? processingError.message
          : 'Unexpected webhook processing error.',
      });

      throw processingError;
    }
  } catch (error) {
    return errorResponse(error, {
      requestId,
      functionName: FUNCTION_NAME,
      cors: {
        allowedMethods: ['POST'],
        allowedHeaders: ['x-signature', 'x-request-id', 'stripe-signature'],
      },
    });
  }
}
