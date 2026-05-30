import { AppError } from '../errors.ts';

const ACTIVATE_EXTERNAL_PATH = '/plans/external/activate';
const DEFAULT_TIMEOUT_MS = 8_000;

export type ActivateExternalPlanPayload = {
  external_key: string;
  plan_code: 'weight_loss' | 'psychology' | 'family' | string;
  external_plan_id?: number | null;
  external_payment_reference: string;
  paid_at: string;
  amount: number;
  currency: string;
  customer: {
    email: string;
    first_name: string;
    last_name: string;
    document: string;
  };
  metadata: {
    source: 'rapido_doutor';
    order_id: string;
    payment_charge_id: string;
  };
};

export type ActivateExternalPlanResult = {
  subscriptionId: string | null;
  status: string;
  raw: unknown;
};

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function getTimeoutMs() {
  const configured = Number(Deno.env.get('PLANS_SERVICE_TIMEOUT_MS') || 0);

  return Number.isFinite(configured) && configured > 0 ? Math.trunc(configured) : DEFAULT_TIMEOUT_MS;
}

function getPlansServiceBaseUrl() {
  const rawUrl = normalizeString(
    Deno.env.get('PLANS_SERVICE_BASE_URL') || Deno.env.get('PLANS_SERVICE_URL'),
  ).replace(/\/+$/, '');

  if (!rawUrl) {
    return '';
  }

  return rawUrl.endsWith('/api') ? rawUrl : `${rawUrl}/api`;
}

function getInternalApiKey() {
  return normalizeString(Deno.env.get('PLANS_SERVICE_INTERNAL_API_KEY'));
}

function buildActivationUrl() {
  const baseUrl = getPlansServiceBaseUrl();
  const internalApiKey = getInternalApiKey();

  if (!baseUrl || !internalApiKey) {
    throw new AppError({
      status: 500,
      code: 'plans_service_not_configured',
      message: 'Plans service activation is not configured.',
      details: {
        hasBaseUrl: Boolean(baseUrl),
        hasInternalApiKey: Boolean(internalApiKey),
      },
    });
  }

  return {
    url: `${baseUrl}${ACTIVATE_EXTERNAL_PATH}`,
    internalApiKey,
  };
}

function unwrapResource(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  const record = payload as Record<string, unknown>;

  if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
    return record.data as Record<string, unknown>;
  }

  return record;
}

function readNestedObject(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function extractSubscriptionId(payload: unknown) {
  const resource = unwrapResource(payload);
  const subscription = readNestedObject(resource, 'subscription');

  return normalizeString(
    subscription?.id ||
      resource.subscription_id ||
      resource.subscriptionId ||
      resource.id,
  ) || null;
}

function extractStatus(payload: unknown) {
  const resource = unwrapResource(payload);
  const subscription = readNestedObject(resource, 'subscription');

  return normalizeString(
    subscription?.status ||
      resource.status ||
      resource.subscription_status ||
      resource.subscriptionStatus,
  );
}

async function parseResponsePayload(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

export async function activateExternalPlanSubscription(
  payload: ActivateExternalPlanPayload,
): Promise<ActivateExternalPlanResult> {
  const { url, internalApiKey } = buildActivationUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Internal-Api-Key': internalApiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const responsePayload = await parseResponsePayload(response);

    if (!response.ok) {
      throw new AppError({
        status: 502,
        code: 'plans_service_request_failed',
        message: 'Plans service rejected external plan activation.',
        details: {
          status: response.status,
          payload: responsePayload,
        },
      });
    }

    return {
      subscriptionId: extractSubscriptionId(responsePayload),
      status: extractStatus(responsePayload),
      raw: responsePayload,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AppError({
        status: 504,
        code: 'plans_service_timeout',
        message: 'Plans service activation request timed out.',
      });
    }

    throw new AppError({
      status: 502,
      code: 'plans_service_unavailable',
      message: 'Plans service is unavailable for external plan activation.',
      details: error instanceof Error ? error.message : 'Unexpected plans-service error.',
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
