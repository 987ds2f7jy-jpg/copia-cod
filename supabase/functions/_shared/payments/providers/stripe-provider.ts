import { AppError } from '../../errors.ts';
import type { PaymentChargeStatus } from '../types.ts';
import type { PaymentProvider } from './provider-interface.ts';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

type StripeMetadata = Record<string, unknown>;

type StripeCheckoutSession = {
  id?: string;
  url?: string | null;
  status?: string | null;
  payment_status?: string | null;
  payment_intent?: string | StripePaymentIntent | null;
  amount_total?: number | null;
  currency?: string | null;
  expires_at?: number | null;
  client_reference_id?: string | null;
  metadata?: StripeMetadata | null;
  created?: number | null;
};

type StripePaymentIntent = {
  id?: string;
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
  metadata?: StripeMetadata | null;
  latest_charge?: string | StripeCharge | null;
  last_payment_error?: {
    message?: string | null;
  } | null;
  created?: number | null;
};

type StripeCharge = {
  id?: string;
  status?: string | null;
  refunded?: boolean | null;
  disputed?: boolean | null;
  amount_refunded?: number | null;
  failure_message?: string | null;
  metadata?: StripeMetadata | null;
  created?: number | null;
};

type StripeWebhookEvent = {
  id?: string;
  type?: string;
  data?: {
    object?: Record<string, unknown>;
  };
};

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new AppError({
      status: 500,
      code: `${name}_MISSING`,
      message: `${name} is required for Stripe payments.`,
    });
  }

  return value;
}

function getOptionalEnv(name: string) {
  return Deno.env.get(name)?.trim() || '';
}

function getPaymentMethodMode() {
  const configured = getOptionalEnv('STRIPE_PAYMENT_METHOD_MODE').toLowerCase();

  return configured === 'manual' ? 'manual' : 'dynamic';
}

function normalizeCurrency(currency: string) {
  return currency.trim().toLowerCase();
}

function parseMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : 0;
}

function fromMinorAmount(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed) / 100 : 0;
}

function toMinorAmount(value: number) {
  return Math.round(parseMoney(value) * 100);
}

function unixToIso(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) {
    return null;
  }

  return new Date(Number(value) * 1000).toISOString();
}

function readString(value: unknown) {
  return String(value ?? '').trim();
}

function readMetadataString(metadata: StripeMetadata | null | undefined, key: string) {
  return readString(metadata?.[key]);
}

function readObjectMetadata(input: Record<string, unknown>) {
  const raw = input.metadata;

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  return raw as StripeMetadata;
}

function buildQuery(path: string, expands: string[] = []) {
  if (expands.length === 0) {
    return path;
  }

  const query = new URLSearchParams();
  expands.forEach((expand) => query.append('expand[]', expand));
  return `${path}?${query.toString()}`;
}

async function requestStripe<TResponse>({
  path,
  method = 'GET',
  body,
}: {
  path: string;
  method?: 'GET' | 'POST';
  body?: URLSearchParams;
}) {
  const secretKey = getRequiredEnv('STRIPE_SECRET_KEY');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
  };

  if (body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers,
    body: body?.toString(),
  });
  const responseText = await response.text();
  let payload: unknown = {};

  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    payload = { raw: responseText };
  }

  if (!response.ok) {
    throw new AppError({
      status: 502,
      code: 'STRIPE_REQUEST_FAILED',
      message: 'Stripe request failed.',
      details: {
        path,
        status: response.status,
        payload,
      },
    });
  }

  return payload as TResponse;
}

function appendCheckoutSessionTemplate(url: string) {
  if (!url || url.includes('{CHECKOUT_SESSION_ID}')) {
    return url;
  }

  return `${url}${url.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`;
}

function getCheckoutUrls() {
  const successUrl = getOptionalEnv('PAYMENT_SUCCESS_URL');
  const failureUrl = getOptionalEnv('PAYMENT_FAILURE_URL');

  if (successUrl && failureUrl) {
    return {
      success: appendCheckoutSessionTemplate(successUrl),
      cancel: failureUrl,
    };
  }

  const baseUrl = getOptionalEnv('APP_BASE_URL').replace(/\/+$/, '');

  if (!baseUrl) {
    throw new AppError({
      status: 500,
      code: 'APP_BASE_URL_MISSING',
      message: 'APP_BASE_URL or explicit payment return URLs are required for Stripe Checkout.',
    });
  }

  return {
    success: `${baseUrl}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
    cancel: `${baseUrl}/pagamento/falha`,
  };
}

function getEnabledPaymentMethodTypes({
  currency,
  amount,
}: {
  currency: string;
  amount: number;
}) {
  const methods = ['card'];
  const pixEnabled = getOptionalEnv('STRIPE_ENABLE_PIX').toLowerCase() === 'true';
  const boletoEnabled = getOptionalEnv('STRIPE_ENABLE_BOLETO').toLowerCase() === 'true';
  const normalizedCurrency = currency.toUpperCase();

  if (pixEnabled && normalizedCurrency === 'BRL' && amount >= 0.5 && amount <= 3000) {
    methods.push('pix');
  }

  if (boletoEnabled && normalizedCurrency === 'BRL' && amount >= 5) {
    methods.push('boleto');
  }

  return methods;
}

function shouldUseManualPaymentMethods() {
  return getPaymentMethodMode() === 'manual';
}

function buildCheckoutSessionBody(input: {
  internalChargeId: string;
  ownerType: string;
  ownerId: string;
  attemptNumber: number;
  amount: number;
  currency: string;
  externalReference: string;
}) {
  const urls = getCheckoutUrls();
  const useManualPaymentMethods = shouldUseManualPaymentMethods();
  const paymentMethodTypes = useManualPaymentMethods
    ? getEnabledPaymentMethodTypes({
      currency: input.currency,
      amount: input.amount,
    })
    : [];
  const params = new URLSearchParams();

  params.set('mode', 'payment');
  params.set('client_reference_id', input.externalReference);
  params.set('success_url', urls.success);
  params.set('cancel_url', urls.cancel);
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', normalizeCurrency(input.currency));
  params.set('line_items[0][price_data][unit_amount]', String(toMinorAmount(input.amount)));
  params.set('line_items[0][price_data][product_data][name]', 'Rapido Doutor - Servico de saude');
  params.set(
    'line_items[0][price_data][product_data][description]',
    'Pagamento seguro do atendimento na plataforma.',
  );
  params.set('metadata[external_reference]', input.externalReference);
  params.set('metadata[internal_charge_id]', input.internalChargeId);
  params.set('metadata[owner_type]', input.ownerType);
  params.set('metadata[owner_id]', input.ownerId);
  params.set('metadata[attempt_number]', String(input.attemptNumber));
  params.set('payment_intent_data[metadata][external_reference]', input.externalReference);
  params.set('payment_intent_data[metadata][internal_charge_id]', input.internalChargeId);
  params.set('payment_intent_data[metadata][owner_type]', input.ownerType);
  params.set('payment_intent_data[metadata][owner_id]', input.ownerId);
  params.set('payment_intent_data[metadata][attempt_number]', String(input.attemptNumber));

  if (useManualPaymentMethods) {
    paymentMethodTypes.forEach((method) => {
      params.append('payment_method_types[]', method);
    });
  }

  const pixExpiration = Number(getOptionalEnv('STRIPE_PIX_EXPIRES_AFTER_SECONDS'));

  if (useManualPaymentMethods && paymentMethodTypes.includes('pix') && Number.isFinite(pixExpiration) && pixExpiration > 0) {
    params.set('payment_method_options[pix][expires_after_seconds]', String(Math.trunc(pixExpiration)));
  }

  const boletoExpirationDays = Number(getOptionalEnv('STRIPE_BOLETO_EXPIRES_AFTER_DAYS'));

  if (
    useManualPaymentMethods &&
    paymentMethodTypes.includes('boleto') &&
    Number.isFinite(boletoExpirationDays) &&
    boletoExpirationDays > 0
  ) {
    params.set('payment_method_options[boleto][expires_after_days]', String(Math.trunc(boletoExpirationDays)));
  }

  return {
    params,
    paymentMethodTypes,
  };
}

async function retrieveCheckoutSession(sessionId: string) {
  return requestStripe<StripeCheckoutSession>({
    path: buildQuery(`/checkout/sessions/${encodeURIComponent(sessionId)}`, [
      'payment_intent.latest_charge',
    ]),
  });
}

async function retrievePaymentIntent(paymentIntentId: string) {
  return requestStripe<StripePaymentIntent>({
    path: buildQuery(`/payment_intents/${encodeURIComponent(paymentIntentId)}`, [
      'latest_charge',
    ]),
  });
}

function resolvePaymentIntentId(session: StripeCheckoutSession | null) {
  const paymentIntent = session?.payment_intent;

  if (!paymentIntent) {
    return '';
  }

  if (typeof paymentIntent === 'string') {
    return paymentIntent.trim();
  }

  return readString(paymentIntent.id);
}

function resolveCharge(paymentIntent: StripePaymentIntent | null) {
  const latestCharge = paymentIntent?.latest_charge;

  if (!latestCharge || typeof latestCharge === 'string') {
    return null;
  }

  return latestCharge as StripeCharge;
}

function mapStripeStatus({
  session,
  paymentIntent,
  charge,
}: {
  session: StripeCheckoutSession | null;
  paymentIntent: StripePaymentIntent | null;
  charge: StripeCharge | null;
}): PaymentChargeStatus {
  if (charge?.disputed) {
    return 'chargeback';
  }

  if (charge?.refunded || Number(charge?.amount_refunded || 0) > 0) {
    return 'refunded';
  }

  if (session?.status === 'expired') {
    return 'payment_expired';
  }

  switch (readString(paymentIntent?.status)) {
    case 'succeeded':
      return 'paid';
    case 'processing':
      return 'payment_processing';
    case 'requires_payment_method':
      return 'payment_failed';
    case 'canceled':
      return session?.status === 'expired' ? 'payment_expired' : 'payment_failed';
    case 'requires_capture':
      return 'payment_processing';
    case 'requires_action':
    case 'requires_confirmation':
      return 'payment_pending';
    default:
      break;
  }

  if (readString(session?.payment_status) === 'paid') {
    return 'paid';
  }

  if (readString(session?.status) === 'complete') {
    return 'payment_processing';
  }

  return 'payment_pending';
}

async function hmacSha256Hex(secret: string, message: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return result === 0;
}

function parseStripeSignatureHeader(header: string) {
  const values = header.split(',').reduce<Record<string, string[]>>((acc, part) => {
    const [rawKey, rawValue] = part.split('=');
    const key = readString(rawKey);
    const value = readString(rawValue);

    if (!key || !value) {
      return acc;
    }

    acc[key] = acc[key] || [];
    acc[key].push(value);
    return acc;
  }, {});

  return {
    timestamp: readString(values.t?.[0]),
    signatures: values.v1 || [],
  };
}

async function assertStripeWebhookSignature(rawBody: string, header: string) {
  const webhookSecret = getRequiredEnv('STRIPE_WEBHOOK_SECRET');
  const { timestamp, signatures } = parseStripeSignatureHeader(header);
  const timestampSeconds = Number(timestamp);

  if (!timestamp || signatures.length === 0 || !Number.isFinite(timestampSeconds)) {
    throw new AppError({
      status: 401,
      code: 'STRIPE_WEBHOOK_SIGNATURE_INVALID',
      message: 'Stripe webhook signature is incomplete.',
    });
  }

  if (Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > STRIPE_WEBHOOK_TOLERANCE_SECONDS) {
    throw new AppError({
      status: 401,
      code: 'STRIPE_WEBHOOK_TIMESTAMP_INVALID',
      message: 'Stripe webhook timestamp is outside the allowed tolerance window.',
    });
  }

  const expectedSignature = await hmacSha256Hex(webhookSecret, `${timestamp}.${rawBody}`);
  const isValid = signatures.some((signature) => timingSafeEqual(signature, expectedSignature));

  if (!isValid) {
    throw new AppError({
      status: 401,
      code: 'STRIPE_WEBHOOK_SIGNATURE_INVALID',
      message: 'Stripe webhook signature is invalid.',
    });
  }
}

function extractStripeWebhookReference(event: StripeWebhookEvent) {
  const object = (event.data?.object || {}) as Record<string, unknown>;
  const objectType = readString(object.object);
  const metadata = readObjectMetadata(object);

  if (objectType === 'checkout.session') {
    return {
      providerChargeId: readString(object.id),
      externalReference: readString(object.client_reference_id) || readMetadataString(metadata, 'external_reference'),
    };
  }

  if (objectType === 'payment_intent') {
    return {
      providerChargeId: readString(object.id),
      externalReference: readMetadataString(metadata, 'external_reference'),
    };
  }

  if (objectType === 'charge') {
    return {
      providerChargeId: readString(object.payment_intent) || readString(object.id),
      externalReference: readMetadataString(metadata, 'external_reference'),
    };
  }

  return {
    providerChargeId: readString(object.id),
    externalReference: readMetadataString(metadata, 'external_reference'),
  };
}

export function createStripePaymentProvider(): PaymentProvider {
  return {
    name: 'stripe',

    async createCharge(input) {
      const { params, paymentMethodTypes } = buildCheckoutSessionBody(input);
      const session = await requestStripe<StripeCheckoutSession>({
        path: '/checkout/sessions',
        method: 'POST',
        body: params,
      });
      const providerChargeId = readString(session.id);
      const checkoutUrl = readString(session.url);
      const paymentReference = resolvePaymentIntentId(session) || providerChargeId;

      if (!providerChargeId || !checkoutUrl) {
        throw new AppError({
          status: 502,
          code: 'STRIPE_CHECKOUT_SESSION_INVALID',
          message: 'Stripe Checkout session response is invalid.',
          details: session,
        });
      }

      return {
        provider: 'stripe',
        providerChargeId,
        checkoutUrl,
        paymentReference,
        raw: {
          ...session,
          configured_payment_method_types: paymentMethodTypes,
          payment_method_mode: getPaymentMethodMode(),
        } as Record<string, unknown>,
      };
    },

    async getChargeStatus(providerChargeId) {
      const isCheckoutSession = providerChargeId.startsWith('cs_');
      const session = isCheckoutSession ? await retrieveCheckoutSession(providerChargeId) : null;
      const paymentIntentId = session ? resolvePaymentIntentId(session) : providerChargeId;
      const paymentIntent = paymentIntentId && paymentIntentId.startsWith('pi_')
        ? await retrievePaymentIntent(paymentIntentId)
        : null;
      const charge = resolveCharge(paymentIntent);
      const status = mapStripeStatus({ session, paymentIntent, charge });
      const externalReference = readMetadataString(paymentIntent?.metadata, 'external_reference') ||
        readString(session?.client_reference_id) ||
        readMetadataString(session?.metadata, 'external_reference') ||
        readMetadataString(charge?.metadata, 'external_reference');
      const amount = paymentIntent
        ? fromMinorAmount(paymentIntent.amount)
        : fromMinorAmount(session?.amount_total);
      const currency = readString(paymentIntent?.currency || session?.currency || 'brl').toUpperCase();
      const rawStatus = [
        readString(session?.status),
        readString(session?.payment_status),
        readString(paymentIntent?.status),
        readString(charge?.status),
      ].filter(Boolean).join(':');

      return {
        provider: 'stripe',
        providerChargeId: readString(session?.id) || providerChargeId,
        paymentReference: readString(paymentIntent?.id) || providerChargeId,
        externalReference,
        status,
        rawStatus,
        amount,
        currency,
        paidAt: status === 'paid'
          ? unixToIso(charge?.created || paymentIntent?.created || session?.created)
          : null,
        failureReason: readString(paymentIntent?.last_payment_error?.message) || readString(charge?.failure_message),
        raw: {
          session,
          paymentIntent,
          charge,
        } as Record<string, unknown>,
      };
    },

    async verifyWebhook({ req, rawBody, body }) {
      const signatureHeader = readString(req.headers.get('stripe-signature'));
      await assertStripeWebhookSignature(rawBody, signatureHeader);

      const event = body as StripeWebhookEvent;
      const { providerChargeId, externalReference } = extractStripeWebhookReference(event);

      if (!providerChargeId) {
        throw new AppError({
          status: 422,
          code: 'STRIPE_WEBHOOK_REFERENCE_MISSING',
          message: 'Stripe webhook event does not include a resolvable charge reference.',
          details: {
            eventType: readString(event.type),
            eventId: readString(event.id),
          },
        });
      }

      return {
        eventId: readString(event.id) || `${readString(event.type)}:${providerChargeId}` || crypto.randomUUID(),
        eventType: readString(event.type) || 'stripe_event',
        providerChargeId,
        externalReference,
      };
    },
  };
}
