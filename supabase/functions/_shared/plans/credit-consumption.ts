import { AppError } from '../errors.ts';
import { logTechnicalEvent } from '../observability.ts';
import type { SupabaseClient } from '../supabase.ts';

type PlanCreditOwnerType = 'appointment' | 'queue';

type UsageRow = {
  id: string;
  status: string;
};

const USE_SCORE_PATH = '/subscription-score/use';
const DEFAULT_TIMEOUT_MS = 8_000;

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getApiBaseUrl() {
  const rawUrl = normalizeString(
    Deno.env.get('PLANS_SERVICE_URL') || Deno.env.get('PLANS_SERVICE_BASE_URL'),
  );

  if (!rawUrl) {
    return '';
  }

  const baseUrl = rawUrl.replace(/\/+$/, '');
  return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
}

function getTimeoutMs() {
  const parsed = Number(Deno.env.get('PLANS_SERVICE_TIMEOUT_MS') || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : DEFAULT_TIMEOUT_MS;
}

async function setFailureState({
  client,
  ownerType,
  ownerId,
  usageId,
  status,
  errorCode,
  errorMessage,
  requestSnapshot,
  responseSnapshot,
}: {
  client: SupabaseClient;
  ownerType: PlanCreditOwnerType;
  ownerId: string;
  usageId: string;
  status: 'use_failed' | 'reconciliation_required';
  errorCode: string;
  errorMessage: string;
  requestSnapshot: Record<string, unknown>;
  responseSnapshot: Record<string, unknown>;
}) {
  await client
    .from('plan_credit_usages')
    .update({
      status,
      request_snapshot: requestSnapshot,
      response_snapshot: responseSnapshot,
      error_code: errorCode,
      error_message: errorMessage,
    })
    .eq('id', usageId)
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .eq('status', 'consuming');

  const table = ownerType === 'appointment' ? 'appointments' : 'queues';
  await client
    .from(table)
    .update({
      coverage_status: status === 'reconciliation_required'
        ? 'plan_reconciliation_required'
        : 'plan_use_failed',
    })
    .eq('id', ownerId)
    .eq('plan_credit_usage_id', usageId);
}

async function postUseScore(subscriptionScoreId: number) {
  const apiBaseUrl = getApiBaseUrl();

  if (!apiBaseUrl) {
    throw new AppError({
      status: 503,
      code: 'PLANS_SERVICE_NOT_CONFIGURED',
      message: 'Plan credit could not be confirmed right now.',
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getTimeoutMs());
  const headers = new Headers({ Accept: 'application/json', 'Content-Type': 'application/json' });
  const internalApiKey = normalizeString(Deno.env.get('PLANS_SERVICE_INTERNAL_API_KEY'));

  if (internalApiKey) {
    headers.set('X-Internal-Api-Key', internalApiKey);
  }

  try {
    const response = await fetch(`${apiBaseUrl}${USE_SCORE_PATH}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ score_id: subscriptionScoreId }),
      signal: controller.signal,
    });
    let payload: unknown = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    return { ok: response.ok, status: response.status, payload };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function consumePlanCreditOnce({
  client,
  ownerType,
  ownerId,
  usageId,
  externalSubscriptionScoreId,
}: {
  client: SupabaseClient;
  ownerType: PlanCreditOwnerType;
  ownerId: string;
  usageId: string;
  externalSubscriptionScoreId: string;
}) {
  logTechnicalEvent('info', {
    functionName: 'plan-credit',
    operation: 'plan_credit.consume',
    resourceType: ownerType,
    resourceId: ownerId,
    status: 'started',
  });

  const subscriptionScoreId = Number(externalSubscriptionScoreId || 0);

  if (!Number.isInteger(subscriptionScoreId) || subscriptionScoreId <= 0) {
    throw new AppError({
      status: 422,
      code: 'PLAN_CREDIT_SUBSCRIPTION_SCORE_ID_REQUIRED',
      message: 'Plan credit audit is missing the external score id required for consumption.',
      details: { ownerType, ownerId, usageId },
    });
  }

  const { data: claimedData, error: claimError } = await client
    .from('plan_credit_usages')
    .update({
      status: 'consuming',
      error_code: null,
      error_message: null,
    })
    .eq('id', usageId)
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .in('status', ['pending_use', 'use_failed'])
    .select('id, status')
    .maybeSingle();

  if (claimError) {
    throw new AppError({
      status: 500,
      code: 'PLAN_CREDIT_CLAIM_FAILED',
      message: 'Unable to claim the plan credit for confirmation.',
      details: claimError.message,
    });
  }

  if (!(claimedData as UsageRow | null)?.id) {
    const { data: currentData, error: currentError } = await client
      .from('plan_credit_usages')
      .select('id, status')
      .eq('id', usageId)
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (currentError || !(currentData as UsageRow | null)?.id) {
      throw new AppError({
        status: 409,
        code: 'PLAN_CREDIT_USAGE_NOT_FOUND',
        message: 'Plan credit usage could not be resolved.',
      });
    }

    const current = currentData as UsageRow;

    if (current.status === 'used') {
      logTechnicalEvent('info', {
        functionName: 'plan-credit',
        operation: 'plan_credit.consume',
        resourceType: ownerType,
        resourceId: ownerId,
        status: 'already_used',
      });
      return { skipped: true, reason: 'already_used' as const };
    }

    throw new AppError({
      status: 409,
      code: current.status === 'consuming'
        ? 'PLAN_CREDIT_CONFIRMATION_IN_PROGRESS'
        : 'PLAN_CREDIT_RECONCILIATION_REQUIRED',
      message: current.status === 'consuming'
        ? 'Plan credit confirmation is already in progress.'
        : 'Plan credit requires reconciliation before this service can be released.',
      details: { ownerType, ownerId, usageId, status: current.status },
    });
  }

  const requestSnapshot = { external_subscription_score_id: subscriptionScoreId };
  let externalResponse: Awaited<ReturnType<typeof postUseScore>>;

  try {
    externalResponse = await postUseScore(subscriptionScoreId);
  } catch (error) {
    const errorCode = error instanceof DOMException && error.name === 'AbortError'
      ? 'PLANS_SERVICE_TIMEOUT'
      : error instanceof AppError
      ? error.code
      : 'PLANS_SERVICE_UNAVAILABLE';
    const errorMessage = error instanceof Error ? error.message : 'Plan credit confirmation failed.';

    await setFailureState({
      client,
      ownerType,
      ownerId,
      usageId,
      status: 'reconciliation_required',
      errorCode,
      errorMessage,
      requestSnapshot,
      responseSnapshot: {},
    });
    throw error;
  }

  const responseSnapshot = toRecord(externalResponse.payload);

  if (!externalResponse.ok) {
    const ambiguous = externalResponse.status >= 500 || externalResponse.status === 409 || externalResponse.status === 422;
    const errorMessage = normalizeString(responseSnapshot.error)
      || normalizeString(responseSnapshot.message)
      || 'Plan credit confirmation was rejected.';

    await setFailureState({
      client,
      ownerType,
      ownerId,
      usageId,
      status: ambiguous ? 'reconciliation_required' : 'use_failed',
      errorCode: `PLANS_SERVICE_${externalResponse.status}`,
      errorMessage,
      requestSnapshot,
      responseSnapshot: {
        status: externalResponse.status,
        error: errorMessage,
      },
    });

    throw new AppError({
      status: ambiguous ? 409 : 502,
      code: ambiguous ? 'PLAN_CREDIT_RECONCILIATION_REQUIRED' : 'PLAN_CREDIT_USE_FAILED',
      message: ambiguous
        ? 'Plan credit confirmation is ambiguous and requires reconciliation.'
        : 'Plan credit could not be confirmed.',
      details: { ownerType, ownerId, usageId, externalStatus: externalResponse.status },
    });
  }

  const { error: finalizeError } = await client.rpc('finalize_plan_credit_usage', {
    p_usage_id: usageId,
    p_owner_type: ownerType,
    p_owner_id: ownerId,
    p_request_snapshot: requestSnapshot,
    p_response_snapshot: {
      external_status: externalResponse.status,
      confirmed: true,
    },
  });

  if (finalizeError) {
    await setFailureState({
      client,
      ownerType,
      ownerId,
      usageId,
      status: 'reconciliation_required',
      errorCode: 'PLAN_CREDIT_LOCAL_FINALIZE_FAILED',
      errorMessage: finalizeError.message,
      requestSnapshot,
      responseSnapshot: { external_status: externalResponse.status, confirmed: true },
    });

    throw new AppError({
      status: 500,
      code: 'PLAN_CREDIT_LOCAL_FINALIZE_FAILED',
      message: 'Plan credit was confirmed externally but requires local reconciliation.',
      details: { ownerType, ownerId, usageId },
    });
  }

  logTechnicalEvent('info', {
    functionName: 'plan-credit',
    operation: 'plan_credit.consume',
    resourceType: ownerType,
    resourceId: ownerId,
    status: 'used',
  });

  return { skipped: false, reason: 'used_now' as const };
}
