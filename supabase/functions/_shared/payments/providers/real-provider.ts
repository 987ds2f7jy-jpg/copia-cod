import { AppError } from '../../errors.ts';
import type { PaymentChargeStatus } from '../types.ts';
import type { PaymentProvider } from './provider-interface.ts';

const MERCADO_PAGO_API_BASE = 'https://api.mercadopago.com';

type MercadoPagoPreferenceResponse = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
  external_reference?: string;
};

type MercadoPagoPaymentResponse = {
  id?: number | string;
  status?: string;
  status_detail?: string;
  transaction_amount?: number | string;
  currency_id?: string;
  external_reference?: string;
  preference_id?: string;
  date_approved?: string | null;
};

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new AppError({
      status: 500,
      code: `${name}_MISSING`,
      message: `${name} is required for Mercado Pago payments.`,
    });
  }

  return value;
}

function getOptionalEnv(name: string) {
  return Deno.env.get(name)?.trim() || '';
}

function roundMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : 0;
}

function mapMercadoPagoStatus(status: string, statusDetail = ''): PaymentChargeStatus {
  if (statusDetail === 'expired' || status === 'expired') {
    return 'payment_expired';
  }

  switch (status) {
    case 'approved':
    case 'accredited':
      return 'paid';
    case 'pending':
      return 'payment_pending';
    case 'in_process':
    case 'authorized':
      return 'payment_processing';
    case 'rejected':
      return 'payment_failed';
    case 'cancelled':
      return 'payment_expired';
    case 'refunded':
    case 'partially_refunded':
      return 'refunded';
    case 'charged_back':
      return 'chargeback';
    default:
      return 'payment_processing';
  }
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

function parseSignatureHeader(header: string) {
  const parts = header.split(',');
  const values: Record<string, string> = {};

  parts.forEach((part) => {
    const [key, value] = part.split('=');
    if (key && value) {
      values[key.trim()] = value.trim();
    }
  });

  return {
    ts: values.ts || '',
    v1: values.v1 || '',
  };
}

function normalizeDataId(value: string) {
  const trimmed = value.trim();
  return /^[a-zA-Z0-9]+$/.test(trimmed) ? trimmed.toLowerCase() : trimmed;
}

function readNestedString(record: Record<string, unknown>, path: string[]) {
  let current: unknown = record;

  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return '';
    }

    current = (current as Record<string, unknown>)[key];
  }

  return String(current ?? '').trim();
}

function buildWebhookManifest({
  dataId,
  requestId,
  ts,
}: {
  dataId: string;
  requestId: string;
  ts: string;
}) {
  let manifest = '';

  if (dataId) {
    manifest += `id:${normalizeDataId(dataId)};`;
  }

  if (requestId) {
    manifest += `request-id:${requestId};`;
  }

  if (ts) {
    manifest += `ts:${ts};`;
  }

  return manifest;
}

function getBackUrls() {
  const success = getOptionalEnv('PAYMENT_SUCCESS_URL');
  const failure = getOptionalEnv('PAYMENT_FAILURE_URL');
  const pending = getOptionalEnv('PAYMENT_PENDING_URL');

  if (success && failure && pending) {
    return {
      success,
      failure,
      pending,
    };
  }

  const baseUrl = getOptionalEnv('APP_BASE_URL').replace(/\/+$/, '');

  if (!baseUrl) {
    return null;
  }

  return {
    success: `${baseUrl}/pagamento/sucesso`,
    failure: `${baseUrl}/pagamento/falha`,
    pending: `${baseUrl}/pagamento/pendente`,
  };
}

function getNotificationUrl() {
  const explicitUrl = getOptionalEnv('MERCADO_PAGO_WEBHOOK_URL');

  if (explicitUrl) {
    return explicitUrl;
  }

  const supabaseUrl = getOptionalEnv('SUPABASE_URL').replace(/\/+$/, '');

  if (!supabaseUrl) {
    return '';
  }

  return `${supabaseUrl}/functions/v1/payments/webhook?source_news=webhooks`;
}

async function requestMercadoPago<TResponse>({
  path,
  method = 'GET',
  idempotencyKey,
  body,
}: {
  path: string;
  method?: 'GET' | 'POST';
  idempotencyKey?: string;
  body?: Record<string, unknown>;
}) {
  const accessToken = getRequiredEnv('MERCADO_PAGO_ACCESS_TOKEN');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  if (idempotencyKey) {
    headers['X-Idempotency-Key'] = idempotencyKey.slice(0, 64);
  }

  const response = await fetch(`${MERCADO_PAGO_API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
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
      code: 'MERCADO_PAGO_REQUEST_FAILED',
      message: 'Mercado Pago request failed.',
      details: {
        status: response.status,
        path,
        payload,
      },
    });
  }

  return payload as TResponse;
}

export function createMercadoPagoProvider(): PaymentProvider {
  return {
    name: 'mercadopago',

    async createCharge(input) {
      const notificationUrl = getNotificationUrl();
      const backUrls = getBackUrls();
      const preferenceBody: Record<string, unknown> = {
        external_reference: input.externalReference,
        notification_url: notificationUrl || undefined,
        auto_return: backUrls ? 'approved' : undefined,
        back_urls: backUrls || undefined,
        items: [
          {
            id: input.internalChargeId,
            title: 'Rapido Doutor - Atendimento de saude',
            quantity: 1,
            currency_id: input.currency,
            unit_price: input.amount,
          },
        ],
        metadata: {
          internal_charge_id: input.internalChargeId,
          owner_type: input.ownerType,
          owner_id: input.ownerId,
          attempt_number: input.attemptNumber,
        },
      };
      const response = await requestMercadoPago<MercadoPagoPreferenceResponse>({
        path: '/checkout/preferences',
        method: 'POST',
        idempotencyKey: input.idempotencyKey,
        body: preferenceBody,
      });
      const providerChargeId = String(response.id || '').trim();

      if (!providerChargeId) {
        throw new AppError({
          status: 502,
          code: 'MERCADO_PAGO_PREFERENCE_INVALID',
          message: 'Mercado Pago did not return a preference id.',
          details: response,
        });
      }

      return {
        provider: 'mercadopago',
        providerChargeId,
        checkoutUrl: String(response.init_point || response.sandbox_init_point || ''),
        paymentReference: input.externalReference,
        raw: response as Record<string, unknown>,
      };
    },

    async getChargeStatus(providerChargeId) {
      const response = await requestMercadoPago<MercadoPagoPaymentResponse>({
        path: `/v1/payments/${encodeURIComponent(providerChargeId)}`,
      });
      const rawStatus = String(response.status || '').trim();
      const statusDetail = String(response.status_detail || '').trim();

      return {
        provider: 'mercadopago',
        providerChargeId,
        paymentReference: String(response.id || providerChargeId),
        externalReference: String(response.external_reference || ''),
        status: mapMercadoPagoStatus(rawStatus, statusDetail),
        rawStatus: statusDetail ? `${rawStatus}:${statusDetail}` : rawStatus,
        amount: roundMoney(response.transaction_amount),
        currency: String(response.currency_id || 'BRL').toUpperCase(),
        paidAt: response.date_approved || null,
        failureReason: statusDetail,
        raw: response as Record<string, unknown>,
      };
    },

    async verifyWebhook({ req, body }) {
      const webhookSecret = getRequiredEnv('MERCADO_PAGO_WEBHOOK_SECRET');
      const signatureHeader = req.headers.get('x-signature') || '';
      const requestId = req.headers.get('x-request-id') || '';
      const { ts, v1 } = parseSignatureHeader(signatureHeader);
      const url = new URL(req.url);
      const bodyDataId = readNestedString(body, ['data', 'id']);
      const dataId = url.searchParams.get('data.id') || url.searchParams.get('id') || bodyDataId;

      if (!ts || !v1 || !dataId) {
        throw new AppError({
          status: 401,
          code: 'MERCADO_PAGO_WEBHOOK_SIGNATURE_INVALID',
          message: 'Mercado Pago webhook signature data is incomplete.',
        });
      }

      const manifest = buildWebhookManifest({ dataId, requestId, ts });
      const expectedSignature = await hmacSha256Hex(webhookSecret, manifest);

      if (!timingSafeEqual(expectedSignature, v1)) {
        throw new AppError({
          status: 401,
          code: 'MERCADO_PAGO_WEBHOOK_SIGNATURE_INVALID',
          message: 'Mercado Pago webhook signature is invalid.',
        });
      }

      return {
        eventId: String(body.id || `${readNestedString(body, ['action'])}:${dataId}` || crypto.randomUUID()),
        eventType: String(body.type || body.topic || body.action || 'payment'),
        providerChargeId: dataId,
        externalReference: '',
      };
    },
  };
}
