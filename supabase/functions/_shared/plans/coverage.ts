import { AppError } from '../errors.ts';
import { normalizePricingSpecialty } from '../pricing/service-codes.ts';
import type { SupabaseClient } from '../supabase.ts';

export type PlanCoverageVerification = {
  covered: true;
  reason: 'plan_credit_available';
  specialtyCode: string;
  planSubscriptionOrderId: string;
  plansServiceSubscriptionId: string | null;
  externalSubscriptionId: string | number | null;
  externalSubscriptionScoreId: string;
  externalScoreId: string | number | null;
  externalPlanId: number | null;
  externalSpecializationId: number;
  rawStatus: string | number | null;
  requestSnapshot: Record<string, unknown>;
  responseSnapshot: Record<string, unknown>;
};

type ActivePlanOrderRow = {
  id: string;
  external_plan_id: number | string | null;
  external_key: string | null;
  plans_service_subscription_id: string | null;
};

type ExternalScoreResource = {
  id?: string | number | null;
  subscription_id?: string | number | null;
  score_id?: string | number | null;
  status?: string | number | null;
  subscription?: {
    id?: string | number | null;
    plan_id?: string | number | null;
  } | null;
  score?: {
    id?: string | number | null;
  } | null;
};

type SpecialtyPlanLookup = {
  externalSpecializationId: number;
  planIds: number[];
};

const FIND_SCORE_PATH = '/subscription-score/find';
const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;

export const SPECIALTY_PLAN_LOOKUPS: Record<string, SpecialtyPlanLookup> = {
  medicina_integrativa: { externalSpecializationId: 1, planIds: [3] },
  clinico_geral: { externalSpecializationId: 2, planIds: [3, 2] },
  clinica_medica: { externalSpecializationId: 2, planIds: [3, 2] },
  pediatria: { externalSpecializationId: 4, planIds: [3] },
  ginecologia: { externalSpecializationId: 5, planIds: [3] },
  dermatologia: { externalSpecializationId: 6, planIds: [3] },
  endocrinologia: { externalSpecializationId: 7, planIds: [2, 3] },
  cardiologia: { externalSpecializationId: 8, planIds: [3] },
  psiquiatria: { externalSpecializationId: 9, planIds: [1] },
  neurologia: { externalSpecializationId: 12, planIds: [3] },
  ortopedia: { externalSpecializationId: 18, planIds: [3] },
  fonoaudiologia: { externalSpecializationId: 21, planIds: [3] },
  psicologia: { externalSpecializationId: 22, planIds: [1] },
  nutricao: { externalSpecializationId: 23, planIds: [2] },
  educacao_fisica: { externalSpecializationId: 24, planIds: [2] },
};

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function normalizePlanId(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function unwrapResource(payload: unknown): ExternalScoreResource | null {
  const record = toRecord(payload);
  const value = record.data && typeof record.data === 'object' ? record.data : record;
  return value as ExternalScoreResource;
}

function getApiBaseUrl() {
  const rawUrl = normalizeString(
    Deno.env.get('PLANS_SERVICE_BASE_URL') || Deno.env.get('PLANS_SERVICE_URL'),
  );

  if (!rawUrl) {
    return '';
  }

  const baseUrl = rawUrl.replace(/\/+$/, '');
  return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
}

function getTimeoutMs() {
  const parsed = Number(Deno.env.get('PLANS_SERVICE_TIMEOUT_MS') || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : DEFAULT_REQUEST_TIMEOUT_MS;
}

async function listActivePlanOrders(client: SupabaseClient, appUserId: string) {
  const { data, error } = await client
    .from('plan_subscription_orders')
    .select('id, external_plan_id, external_key, plans_service_subscription_id')
    .or(`app_user_id.eq.${appUserId},patient_id.eq.${appUserId}`)
    .eq('status', 'active')
    .order('activated_at', { ascending: false, nullsFirst: false })
    .limit(10);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PLAN_ORDERS_LOOKUP_FAILED',
      message: 'Unable to load patient active plan orders.',
      details: error.message,
    });
  }

  return (data as ActivePlanOrderRow[] | null) || [];
}

async function findExternalScore({
  apiBaseUrl,
  planId,
  externalKey,
  externalSpecializationId,
}: {
  apiBaseUrl: string;
  planId: number;
  externalKey: string;
  externalSpecializationId: number;
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getTimeoutMs());
  const headers = new Headers({ Accept: 'application/json', 'Content-Type': 'application/json' });
  const internalApiKey = normalizeString(Deno.env.get('PLANS_SERVICE_INTERNAL_API_KEY'));

  if (internalApiKey) {
    headers.set('X-Internal-Api-Key', internalApiKey);
  }

  try {
    const response = await fetch(`${apiBaseUrl}${FIND_SCORE_PATH}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        plan_id: planId,
        external_key: externalKey,
        specialization_id: externalSpecializationId,
      }),
      signal: controller.signal,
    });
    let payload: unknown = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    return { ok: response.ok, status: response.status, payload };
  } catch (error) {
    throw new AppError({
      status: error instanceof DOMException && error.name === 'AbortError' ? 504 : 503,
      code: error instanceof DOMException && error.name === 'AbortError'
        ? 'PLANS_SERVICE_TIMEOUT'
        : 'PLANS_SERVICE_UNAVAILABLE',
      message: 'Plan coverage could not be validated right now.',
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function resolvePlanCoverage({
  client,
  appUserId,
  fallbackExternalKey,
  specialtyCode,
  flow,
}: {
  client: SupabaseClient;
  appUserId: string;
  fallbackExternalKey: string;
  specialtyCode: string;
  flow: 'appointment_specialty' | 'on_duty';
}): Promise<PlanCoverageVerification | null> {
  const normalizedSpecialty = normalizePricingSpecialty(specialtyCode);
  const lookup = SPECIALTY_PLAN_LOOKUPS[normalizedSpecialty] || null;

  if (!lookup) {
    return null;
  }

  const activePlanOrders = await listActivePlanOrders(client, appUserId);

  if (!activePlanOrders.length) {
    return null;
  }

  const candidates = lookup.planIds.flatMap((planId) => {
    const order = activePlanOrders.find((item) => normalizePlanId(item.external_plan_id) === planId);
    const externalKey = normalizeString(order?.external_key) || normalizeString(fallbackExternalKey);
    return order?.id && externalKey ? [{ planId, order, externalKey }] : [];
  });

  if (!candidates.length) {
    return null;
  }

  const apiBaseUrl = getApiBaseUrl();

  if (!apiBaseUrl) {
    throw new AppError({
      status: 503,
      code: 'PLANS_SERVICE_NOT_CONFIGURED',
      message: 'Plan coverage cannot be validated right now.',
    });
  }

  for (const candidate of candidates) {
    const response = await findExternalScore({
      apiBaseUrl,
      planId: candidate.planId,
      externalKey: candidate.externalKey,
      externalSpecializationId: lookup.externalSpecializationId,
    });

    if (response.status === 404) {
      continue;
    }

    if (!response.ok) {
      throw new AppError({
        status: response.status >= 500 ? 503 : 502,
        code: 'PLANS_SERVICE_COVERAGE_REJECTED',
        message: 'Plan coverage could not be validated right now.',
        details: { externalStatus: response.status },
      });
    }

    const resource = unwrapResource(response.payload);

    if (!resource?.id) {
      continue;
    }

    const subscription = resource.subscription || null;
    const score = resource.score || null;
    const externalSubscriptionScoreId = normalizeString(resource.id);
    const externalSubscriptionId = subscription?.id || resource.subscription_id || null;
    const externalScoreId = score?.id || resource.score_id || null;
    const responsePlanId = normalizePlanId(subscription?.plan_id);
    const localSubscriptionId = normalizeString(candidate.order.plans_service_subscription_id);

    if (responsePlanId && responsePlanId !== candidate.planId) {
      throw new AppError({
        status: 502,
        code: 'PLANS_SERVICE_COVERAGE_OWNER_MISMATCH',
        message: 'Plan coverage response does not match the validated local plan.',
      });
    }

    if (localSubscriptionId && externalSubscriptionId && localSubscriptionId !== normalizeString(externalSubscriptionId)) {
      throw new AppError({
        status: 502,
        code: 'PLANS_SERVICE_SUBSCRIPTION_MISMATCH',
        message: 'Plan coverage response does not match the validated subscription.',
      });
    }

    const externalPlanId = responsePlanId || candidate.planId;

    return {
      covered: true,
      reason: 'plan_credit_available',
      specialtyCode: normalizedSpecialty,
      planSubscriptionOrderId: candidate.order.id,
      plansServiceSubscriptionId: normalizeString(candidate.order.plans_service_subscription_id) || null,
      externalSubscriptionId,
      externalSubscriptionScoreId,
      externalScoreId,
      externalPlanId,
      externalSpecializationId: lookup.externalSpecializationId,
      rawStatus: resource.status || null,
      requestSnapshot: {
        flow,
        specialty_code: normalizedSpecialty,
        plan_id: candidate.planId,
        external_specialization_id: lookup.externalSpecializationId,
        plan_subscription_order_id: candidate.order.id,
      },
      responseSnapshot: {
        external_subscription_id: externalSubscriptionId,
        external_subscription_score_id: externalSubscriptionScoreId,
        external_score_id: externalScoreId,
        external_plan_id: externalPlanId,
        status: resource.status || null,
      },
    };
  }

  return null;
}
