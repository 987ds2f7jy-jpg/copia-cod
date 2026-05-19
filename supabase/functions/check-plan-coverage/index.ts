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
import { normalizePricingSpecialty } from '../_shared/pricing/service-codes.ts';
import { requireAppUserByAuthUserId, requireRole } from '../_shared/professional.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
} from '../_shared/supabase.ts';

const FUNCTION_NAME = 'check-plan-coverage';
const CORS: CorsOptions = { allowedMethods: ['POST'] };
const FIND_SCORE_PATH = '/subscription-score/find';
const DEFAULT_STAGE_PLAN_ID = 1;
const REQUEST_TIMEOUT_MS = 5_000;

type CoverageFlow =
  | 'specialty'
  | 'appointment_specialty'
  | 'duty'
  | 'on_duty'
  | 'appointment_profile'
  | 'profile'
  | 'solicitacao_exame'
  | string;

type RequestBody = {
  flow?: CoverageFlow;
  specialty_code?: string;
  specialtyCode?: string;
  specialty?: string;
  plan_id?: number | string;
  planId?: number | string;
};

type CoverageReason =
  | 'plan_credit_available'
  | 'no_plan_credit_available'
  | 'plans_service_not_configured'
  | 'plans_service_unavailable'
  | 'plans_service_rejected_request'
  | 'specialty_not_mapped'
  | 'flow_not_plan_eligible';

type CoverageResult = {
  covered: boolean;
  funding_source: 'plan' | 'self_pay';
  reason: CoverageReason;
  specialty_code: string;
  external_specialization_id: number | null;
  external_plan_id: number | null;
  external_subscription_id?: string | number | null;
  external_subscription_score_id?: string | number | null;
  external_score_id?: string | number | null;
  raw_status?: string | number | null;
  message: string;
};

type ExternalScoreResource = {
  id?: string | number | null;
  subscription_id?: string | number | null;
  score_id?: string | number | null;
  status?: string | number | null;
  score?: {
    id?: string | number | null;
    specialization_id?: string | number | null;
    concil_type?: string | number | null;
  } | null;
  subscription?: {
    id?: string | number | null;
    plan_id?: string | number | null;
    external_key?: string | null;
    status?: string | number | null;
  } | null;
};

type SpecialtyPlanLookup = {
  externalSpecializationId: number;
  planIds: number[];
};

const SPECIALTY_PLAN_LOOKUPS: Record<string, SpecialtyPlanLookup> = {
  // IDs from plans-service SpecializationSeeder. Plan IDs are tried in order.
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

function normalizeFlow(value: unknown) {
  return normalizeString(value).toLowerCase();
}

function normalizePlanId(value: unknown) {
  const parsed = Number(value || 0);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return null;
}

function getDefaultPlanId() {
  return normalizePlanId(Deno.env.get('PLANS_SERVICE_DEFAULT_PLAN_ID')) || DEFAULT_STAGE_PLAN_ID;
}

function getPlansServiceApiBaseUrl() {
  const rawUrl = normalizeString(
    Deno.env.get('PLANS_SERVICE_URL') || Deno.env.get('PLANS_SERVICE_BASE_URL'),
  );

  if (!rawUrl) {
    return '';
  }

  const baseUrl = rawUrl.replace(/\/+$/, '');

  return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
}

function buildBaseResult({
  reason,
  specialtyCode,
  externalSpecializationId = null,
  externalPlanId = null,
}: {
  reason: CoverageReason;
  specialtyCode: string;
  externalSpecializationId?: number | null;
  externalPlanId?: number | null;
}): CoverageResult {
  const messages: Record<CoverageReason, string> = {
    plan_credit_available: 'Plano disponivel para esta consulta.',
    no_plan_credit_available: 'Nenhum credito de plano disponivel para esta consulta.',
    plans_service_not_configured: 'Consulta de planos indisponivel neste ambiente. Fluxo avulso permanece disponivel.',
    plans_service_unavailable: 'Nao foi possivel verificar o plano agora. Fluxo avulso permanece disponivel.',
    plans_service_rejected_request: 'Nao foi possivel validar este plano agora. Fluxo avulso permanece disponivel.',
    specialty_not_mapped: 'Esta especialidade ainda nao esta vinculada a planos.',
    flow_not_plan_eligible: 'Este fluxo nao e elegivel para planos.',
  };

  const covered = reason === 'plan_credit_available';

  return {
    covered,
    funding_source: covered ? 'plan' : 'self_pay',
    reason,
    specialty_code: specialtyCode,
    external_specialization_id: externalSpecializationId,
    external_plan_id: externalPlanId,
    message: messages[reason],
  };
}

function parseInput(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as RequestBody;
  const flow = normalizeFlow(record.flow);
  const specialtyCode = normalizePricingSpecialty(
    normalizeString(record.specialty_code || record.specialtyCode || record.specialty),
  );
  const planId = normalizePlanId(record.plan_id || record.planId);

  return {
    flow,
    specialtyCode,
    planId,
  };
}

function isSupportedFlow(flow: string) {
  return flow === 'specialty'
    || flow === 'appointment_specialty'
    || flow === 'duty'
    || flow === 'on_duty';
}

function resolvePlanLookup(specialtyCode: string, requestedPlanId: number | null): SpecialtyPlanLookup | null {
  const lookup = SPECIALTY_PLAN_LOOKUPS[specialtyCode] || null;

  if (!lookup) {
    return null;
  }

  return {
    externalSpecializationId: lookup.externalSpecializationId,
    planIds: requestedPlanId ? [requestedPlanId] : lookup.planIds.length ? lookup.planIds : [getDefaultPlanId()],
  };
}

function unwrapExternalResource(payload: unknown): ExternalScoreResource | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const resource = record.data && typeof record.data === 'object'
    ? record.data
    : record;

  return resource as ExternalScoreResource;
}

function normalizeExternalCoverage({
  payload,
  specialtyCode,
  externalSpecializationId,
  planId,
}: {
  payload: unknown;
  specialtyCode: string;
  externalSpecializationId: number;
  planId: number;
}): CoverageResult {
  const resource = unwrapExternalResource(payload);

  if (!resource?.id) {
    return buildBaseResult({
      reason: 'no_plan_credit_available',
      specialtyCode,
      externalSpecializationId,
      externalPlanId: planId,
    });
  }

  const subscription = resource.subscription || null;
  const score = resource.score || null;

  return {
    ...buildBaseResult({
      reason: 'plan_credit_available',
      specialtyCode,
      externalSpecializationId,
      externalPlanId: Number(subscription?.plan_id || planId),
    }),
    external_subscription_id: subscription?.id || resource.subscription_id || null,
    external_subscription_score_id: resource.id,
    external_score_id: score?.id || resource.score_id || null,
    raw_status: resource.status || null,
  };
}

async function postToPlansService({
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
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${apiBaseUrl}${FIND_SCORE_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
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

    return {
      ok: response.ok,
      status: response.status,
      payload,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function handleCheckPlanCoverageRequest(req: Request) {
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
    const body = await readJsonBody<unknown>(req);
    const input = parseInput(body);
    const client = createServiceRoleClient();
    const authenticatedUser = await requireAuthenticatedUser(req, createSupabaseAuthUserLookup(client));
    const appUser = await requireAppUserByAuthUserId(client, authenticatedUser.authUserId);
    requireRole(appUser, ['patient']);

    if (!isSupportedFlow(input.flow)) {
      const result = buildBaseResult({
        reason: 'flow_not_plan_eligible',
        specialtyCode: input.specialtyCode,
        externalPlanId: input.planId,
      });

      return successResponse(result, requestId, { status: 200, cors: CORS });
    }

    const planLookup = resolvePlanLookup(input.specialtyCode, input.planId);

    if (!planLookup) {
      const result = buildBaseResult({
        reason: 'specialty_not_mapped',
        specialtyCode: input.specialtyCode,
        externalPlanId: input.planId,
      });

      return successResponse(result, requestId, { status: 200, cors: CORS });
    }

    const apiBaseUrl = getPlansServiceApiBaseUrl();

    if (!apiBaseUrl) {
      const result = buildBaseResult({
        reason: 'plans_service_not_configured',
        specialtyCode: input.specialtyCode,
        externalSpecializationId: planLookup.externalSpecializationId,
        externalPlanId: input.planId || planLookup.planIds[0] || null,
      });

      return successResponse(result, requestId, { status: 200, cors: CORS });
    }

    const externalKey = normalizeString(appUser.email || authenticatedUser.email);

    if (!externalKey) {
      const result = buildBaseResult({
        reason: 'plans_service_rejected_request',
        specialtyCode: input.specialtyCode,
        externalSpecializationId: planLookup.externalSpecializationId,
        externalPlanId: input.planId || planLookup.planIds[0] || null,
      });

      return successResponse(result, requestId, { status: 200, cors: CORS });
    }

    let result = buildBaseResult({
      reason: 'no_plan_credit_available',
      specialtyCode: input.specialtyCode,
      externalSpecializationId: planLookup.externalSpecializationId,
      externalPlanId: planLookup.planIds[0] || null,
    });
    let externalStatus: number | null = null;

    for (const planId of planLookup.planIds) {
      let externalResponse: Awaited<ReturnType<typeof postToPlansService>> | null = null;

      try {
        externalResponse = await postToPlansService({
          apiBaseUrl,
          planId,
          externalKey,
          externalSpecializationId: planLookup.externalSpecializationId,
        });
        externalStatus = externalResponse.status;
      } catch (error) {
        console.warn('[check-plan-coverage] plans-service:unavailable', {
          requestId,
          flow: input.flow,
          specialtyCode: input.specialtyCode,
          externalSpecializationId: planLookup.externalSpecializationId,
          externalPlanId: planId,
          error: error instanceof Error ? error.name : 'unknown',
        });

        result = buildBaseResult({
          reason: 'plans_service_unavailable',
          specialtyCode: input.specialtyCode,
          externalSpecializationId: planLookup.externalSpecializationId,
          externalPlanId: planId,
        });

        return successResponse(result, requestId, { status: 200, cors: CORS });
      }

      if (externalResponse.ok) {
        result = normalizeExternalCoverage({
          payload: externalResponse.payload,
          specialtyCode: input.specialtyCode,
          externalSpecializationId: planLookup.externalSpecializationId,
          planId,
        });
        break;
      }

      if (externalResponse.status === 404) {
        result = buildBaseResult({
          reason: 'no_plan_credit_available',
          specialtyCode: input.specialtyCode,
          externalSpecializationId: planLookup.externalSpecializationId,
          externalPlanId: planId,
        });
        continue;
      }

      if (externalResponse.status === 400 || externalResponse.status === 422) {
        result = buildBaseResult({
          reason: 'plans_service_rejected_request',
          specialtyCode: input.specialtyCode,
          externalSpecializationId: planLookup.externalSpecializationId,
          externalPlanId: planId,
        });
        break;
      }

      result = buildBaseResult({
        reason: 'plans_service_unavailable',
        specialtyCode: input.specialtyCode,
        externalSpecializationId: planLookup.externalSpecializationId,
        externalPlanId: planId,
      });
      break;
    }

    console.log('[check-plan-coverage] coverage:checked', {
      requestId,
      flow: input.flow,
      specialtyCode: input.specialtyCode,
      externalSpecializationId: planLookup.externalSpecializationId,
      externalPlanIds: planLookup.planIds,
      externalPlanId: result.external_plan_id,
      covered: result.covered,
      reason: result.reason,
      externalStatus,
    });

    return successResponse(result, requestId, { status: 200, cors: CORS });
  } catch (error) {
    return errorResponse(error, {
      requestId,
      functionName: FUNCTION_NAME,
      cors: CORS,
    });
  }
}

export const checkPlanCoverageHandler = (req: Request) => handleCheckPlanCoverageRequest(req);

Deno.serve(checkPlanCoverageHandler);
