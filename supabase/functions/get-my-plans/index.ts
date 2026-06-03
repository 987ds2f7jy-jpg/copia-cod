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
import {
  aggregateExternalScoresForCredits,
  type AggregatedPlanCredit,
} from '../_shared/plans/plan-scores.ts';
import { PLAN_CATALOG, type PlanCode } from '../_shared/plans/plan-catalog.ts';
import { listExternalPlanScores } from '../_shared/plans-service/client.ts';
import { requireAppUserByAuthUserId, requireRole, type AppUser } from '../_shared/professional.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';

const FUNCTION_NAME = 'get-my-plans';
const CORS: CorsOptions = { allowedMethods: ['POST'] };

type PlanOrderStatus =
  | 'pending_payment'
  | 'payment_confirmed'
  | 'activating_plan'
  | 'active'
  | 'activation_failed'
  | 'canceled'
  | 'refunded';

type PlanSubscriptionOrderRow = {
  id: string;
  patient_id: string | null;
  app_user_id: string | null;
  plan_code: PlanCode | string;
  external_plan_id: number | string | null;
  amount: number | string;
  currency: string | null;
  status: PlanOrderStatus | string;
  payment_status: string | null;
  payment_required: boolean | null;
  current_payment_charge_id: string | null;
  plans_service_subscription_id: string | null;
  external_key: string | null;
  error_code: string | null;
  error_message: string | null;
  paid_at: string | null;
  activated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type CreditTemplate = {
  code: string;
  label: string;
  included: boolean;
};

type PlanReadCatalog = {
  credits: CreditTemplate[];
  included: string[];
  notIncluded: string[];
  familyLimit: number;
};

type CreditsSource = 'plans_service' | 'catalog_estimate' | 'none';

type CreditResolution = {
  credits: Array<ReturnType<typeof buildCatalogCredits>[number] | AggregatedPlanCredit>;
  source: CreditsSource;
  reason: string | null;
  lastSyncedAt: string | null;
};

const CURRENT_ORDER_PRIORITY: Record<string, number> = {
  active: 1,
  activating_plan: 2,
  payment_confirmed: 3,
  pending_payment: 4,
  activation_failed: 5,
};

const COMMON_NOT_INCLUDED = [
  'Consulta por perfil do profissional',
  'Servicos extras',
];

const PLAN_READ_CATALOG: Record<PlanCode, PlanReadCatalog> = {
  family: {
    credits: [
      { code: 'clinico_geral', label: 'Clinico Geral', included: true },
      { code: 'pediatria', label: 'Pediatria', included: true },
      { code: 'ginecologia', label: 'Ginecologia', included: true },
      { code: 'dermatologia', label: 'Dermatologia', included: true },
      { code: 'cardiologia', label: 'Cardiologia', included: true },
      { code: 'psicologia', label: 'Psicologia', included: false },
      { code: 'nutricao', label: 'Nutricao', included: false },
      { code: 'educacao_fisica', label: 'Educacao Fisica', included: false },
    ],
    included: [
      'Consulta com clinico geral',
      'Pediatria',
      'Ginecologia',
      'Dermatologia',
      'Cardiologia',
    ],
    notIncluded: [
      'Psicologia semanal',
      'Nutricao',
      'Educacao fisica',
      ...COMMON_NOT_INCLUDED,
    ],
    familyLimit: 3,
  },
  psychology: {
    credits: [
      { code: 'psicologia', label: 'Psicologia', included: true },
      { code: 'psiquiatria', label: 'Psiquiatria', included: true },
      { code: 'clinico_geral', label: 'Clinico Geral', included: false },
      { code: 'pediatria', label: 'Pediatria', included: false },
      { code: 'nutricao', label: 'Nutricao', included: false },
      { code: 'educacao_fisica', label: 'Educacao Fisica', included: false },
    ],
    included: [
      'Psicologia',
      'Psiquiatria',
    ],
    notIncluded: [
      'Clinico geral',
      'Pediatria',
      'Nutricao',
      'Educacao fisica',
      ...COMMON_NOT_INCLUDED,
    ],
    familyLimit: 0,
  },
  weight_loss: {
    credits: [
      { code: 'clinica_medica', label: 'Clinica Medica', included: true },
      { code: 'nutricao', label: 'Nutricao', included: true },
      { code: 'educacao_fisica', label: 'Educacao Fisica', included: true },
      { code: 'pediatria', label: 'Pediatria', included: false },
      { code: 'psicologia', label: 'Psicologia', included: false },
    ],
    included: [
      'Clinica Medica',
      'Nutricao',
      'Educacao fisica',
    ],
    notIncluded: [
      'Pediatria',
      'Psicologia semanal',
      ...COMMON_NOT_INCLUDED,
    ],
    familyLimit: 0,
  },
};

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function parseMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : 0;
}

function normalizePlanCode(value: unknown): PlanCode | null {
  const normalized = normalizeString(value);

  if (normalized === 'weight_loss' || normalized === 'psychology' || normalized === 'family') {
    return normalized;
  }

  return null;
}

function parseTimestamp(value: unknown) {
  const parsed = Date.parse(normalizeString(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function renewalDayLabelFrom(order: PlanSubscriptionOrderRow) {
  const date = order.activated_at || order.paid_at || order.created_at;

  if (!date) {
    return null;
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return `Todo dia ${parsed.getUTCDate()}`;
}

function orderPriority(order: PlanSubscriptionOrderRow) {
  return CURRENT_ORDER_PRIORITY[order.status] || Number.POSITIVE_INFINITY;
}

function selectCurrentOrder(orders: PlanSubscriptionOrderRow[]) {
  return orders
    .filter((order) => Number.isFinite(orderPriority(order)))
    .sort((left, right) => {
      const priorityDiff = orderPriority(left) - orderPriority(right);

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return parseTimestamp(right.created_at) - parseTimestamp(left.created_at);
    })[0] || null;
}

function buildCatalogCredits(planCode: PlanCode, isActive: boolean) {
  return PLAN_READ_CATALOG[planCode].credits.map((credit) => {
    const total = credit.included ? 1 : 0;
    const available = credit.included && isActive ? total : 0;

    return {
      code: credit.code,
      label: credit.label,
      included: credit.included,
      available,
      used: 0,
      total,
      source: 'catalog_estimate',
    };
  });
}

function buildCatalogCreditResolution(
  planCode: PlanCode,
  isActive: boolean,
  reason: string | null,
): CreditResolution {
  return {
    credits: buildCatalogCredits(planCode, isActive),
    source: 'catalog_estimate',
    reason,
    lastSyncedAt: null,
  };
}

function normalizeExternalSubscriptionId(value: unknown) {
  const parsed = Number(value || 0);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return null;
}

async function resolveCredits({
  order,
  planCode,
  requestId,
}: {
  order: PlanSubscriptionOrderRow;
  planCode: PlanCode;
  requestId: string;
}): Promise<CreditResolution> {
  const isActive = order.status === 'active';

  if (!isActive) {
    return buildCatalogCreditResolution(planCode, false, 'plan_not_active');
  }

  const externalKey = normalizeString(order.external_key);
  const subscriptionId = normalizeExternalSubscriptionId(order.plans_service_subscription_id);

  if (!externalKey) {
    return buildCatalogCreditResolution(planCode, true, 'external_key_missing');
  }

  if (!subscriptionId) {
    return buildCatalogCreditResolution(planCode, true, 'plans_service_subscription_id_missing');
  }

  try {
    const externalScores = await listExternalPlanScores({
      externalKey,
      subscriptionId,
    });
    const credits = aggregateExternalScoresForCredits(externalScores.subscriptions);

    return {
      credits,
      source: 'plans_service',
      reason: null,
      lastSyncedAt: new Date().toISOString(),
    };
  } catch (error) {
    const reason = error instanceof AppError
      ? error.code
      : 'plans_service_scores_unavailable';

    console.warn('[get-my-plans] plans-service:scores-fallback', {
      requestId,
      orderId: order.id,
      reason,
    });

    return buildCatalogCreditResolution(planCode, true, reason);
  }
}

function normalizeCoverageKey(value: string) {
  return normalizeString(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function uniqueLabels(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const label = normalizeString(value);
    const key = normalizeCoverageKey(label);

    if (!label || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(label);
  }

  return result;
}

function buildCoverage(
  planCode: PlanCode | null,
  creditResolution: CreditResolution | null = null,
) {
  if (!planCode) {
    return {
      included: [],
      notIncluded: COMMON_NOT_INCLUDED,
      source: 'none',
    };
  }

  const catalog = PLAN_READ_CATALOG[planCode];

  if (creditResolution?.source === 'plans_service') {
    const included = uniqueLabels(
      creditResolution.credits
        .filter((credit) => credit.included && Number(credit.total || 0) > 0)
        .map((credit) => credit.label),
    );
    const includedKeys = new Set(included.map(normalizeCoverageKey));

    return {
      included,
      notIncluded: catalog.notIncluded.filter((item) => !includedKeys.has(normalizeCoverageKey(item))),
      source: 'plans_service',
    };
  }

  return {
    included: catalog.included,
    notIncluded: catalog.notIncluded,
    source: 'catalog_estimate',
  };
}

function buildDependents({
  appUser,
  planCode,
}: {
  appUser: AppUser;
  planCode: PlanCode | null;
}) {
  const isFamily = planCode === 'family';

  return {
    enabled: isFamily,
    holderName: appUser.fullName || appUser.email || '',
    used: 0,
    limit: isFamily ? PLAN_READ_CATALOG.family.familyLimit : 0,
    items: [],
    source: isFamily ? 'future_dependents_endpoint' : 'not_applicable',
  };
}

function buildActions(order: PlanSubscriptionOrderRow | null) {
  return {
    canContractNewPlan: true,
    canRetryActivation: order?.status === 'activation_failed',
    canAddDependent: false,
  };
}

function buildNoPlanResponse(appUser: AppUser) {
  return {
    state: 'no_plan',
    currentPlan: null,
    credits: [],
    creditsSource: 'none',
    creditsSourceReason: 'not_available_without_plan',
    creditsLastSyncedAt: null,
    coverage: buildCoverage(null),
    usageHistory: [],
    dependents: buildDependents({ appUser, planCode: null }),
    actions: buildActions(null),
    sources: {
      currentPlan: 'local_plan_subscription_orders',
      credits: 'not_available_without_plan',
      usageHistory: 'future_plan_usage_endpoint',
      dependents: 'future_family_members_endpoint',
    },
  };
}

function mapCurrentPlan(order: PlanSubscriptionOrderRow, planCode: PlanCode) {
  const catalog = PLAN_CATALOG[planCode];

  return {
    id: order.id,
    planCode,
    name: catalog.label,
    status: order.status,
    paymentStatus: order.payment_status,
    amount: parseMoney(order.amount),
    currency: normalizeString(order.currency) || catalog.currency,
    createdAt: order.created_at,
    paidAt: order.paid_at,
    activatedAt: order.activated_at,
    nextRenewalAt: null,
    renewalDayLabel: renewalDayLabelFrom(order),
    externalPlanId: Number(order.external_plan_id || catalog.externalPlanId),
    plansServiceSubscriptionId: order.plans_service_subscription_id,
    paymentRequired: Boolean(order.payment_required ?? true),
    currentPaymentChargeId: order.current_payment_charge_id,
    error: order.error_code || order.error_message
      ? {
          code: order.error_code,
          message: order.error_message,
        }
      : null,
  };
}

async function buildPlanResponse(
  appUser: AppUser,
  order: PlanSubscriptionOrderRow,
  requestId: string,
) {
  const planCode = normalizePlanCode(order.plan_code);

  if (!planCode) {
    throw new AppError({
      status: 500,
      code: 'PLAN_ORDER_INVALID_PLAN_CODE',
      message: 'Stored plan order has an invalid plan code.',
      details: {
        orderId: order.id,
        planCode: order.plan_code,
      },
    });
  }

  const creditResolution = await resolveCredits({
    order,
    planCode,
    requestId,
  });

  return {
    state: order.status,
    currentPlan: mapCurrentPlan(order, planCode),
    credits: creditResolution.credits,
    creditsSource: creditResolution.source,
    creditsSourceReason: creditResolution.reason,
    creditsLastSyncedAt: creditResolution.lastSyncedAt,
    coverage: buildCoverage(planCode, creditResolution),
    usageHistory: [],
    dependents: buildDependents({ appUser, planCode }),
    actions: buildActions(order),
    sources: {
      currentPlan: 'local_plan_subscription_orders',
      credits: creditResolution.source,
      usageHistory: 'future_plan_usage_endpoint',
      dependents: planCode === 'family' ? 'future_family_members_endpoint' : 'not_applicable',
    },
  };
}

async function listPatientPlanOrders(client: SupabaseClient, appUserId: string) {
  const { data, error } = await client
    .from('plan_subscription_orders')
    .select(`
      id,
      patient_id,
      app_user_id,
      plan_code,
      external_plan_id,
      amount,
      currency,
      status,
      payment_status,
      payment_required,
      current_payment_charge_id,
      plans_service_subscription_id,
      external_key,
      error_code,
      error_message,
      paid_at,
      activated_at,
      created_at,
      updated_at
    `)
    .or(`app_user_id.eq.${appUserId},patient_id.eq.${appUserId}`)
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(50);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PLAN_ORDERS_LOOKUP_FAILED',
      message: 'Unable to load patient plan orders.',
      details: error.message,
    });
  }

  return (data as PlanSubscriptionOrderRow[] | null) || [];
}

export async function handleGetMyPlansRequest(req: Request) {
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
    await readJsonBody<unknown>(req);

    const client = createServiceRoleClient();
    const authenticatedUser = await requireAuthenticatedUser(req, createSupabaseAuthUserLookup(client));
    const appUser = await requireAppUserByAuthUserId(client, authenticatedUser.authUserId);

    requireRole(appUser, ['patient']);

    const orders = await listPatientPlanOrders(client, appUser.id);
    const currentOrder = selectCurrentOrder(orders);
    const result = currentOrder
      ? await buildPlanResponse(appUser, currentOrder, requestId)
      : buildNoPlanResponse(appUser);

    console.info('[get-my-plans] plans:loaded', {
      requestId,
      appUserId: appUser.id,
      state: result.state,
      currentPlanId: result.currentPlan?.id || null,
      totalOrders: orders.length,
      creditsSource: result.creditsSource,
      creditsSourceReason: result.creditsSourceReason,
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

export const getMyPlansHandler = (req: Request) => handleGetMyPlansRequest(req);

Deno.serve(getMyPlansHandler);
