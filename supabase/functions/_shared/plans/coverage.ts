import { AppError } from '../errors.ts';
import { logTechnicalEvent } from '../observability.ts';
import { normalizePricingSpecialty } from '../pricing/service-codes.ts';
import type { SupabaseClient } from '../supabase.ts';
import { getPlansFacade } from './facade.ts';

export type PlanCoverageVerification = {
  covered: true;
  reason: 'plan_credit_available';
  specialtyCode: string;
  planSubscriptionOrderId: string;
  internalSubscriptionId: string;
  internalSubscriptionScoreId: string;
  internalScoreId: string;
  plansServiceSubscriptionId: string | null;
  externalSubscriptionId: string | number | null;
  externalSubscriptionScoreId: string | null;
  externalScoreId: string | number | null;
  externalPlanId: number;
  externalSpecializationId: number;
  rawStatus: string | number | null;
  requestSnapshot: Record<string, unknown>;
  responseSnapshot: Record<string, unknown>;
};

type ActivePlanOrderRow = {
  id: string;
  plan_code: string;
  external_plan_id: number | string | null;
  external_key: string | null;
  plans_service_subscription_id: string | null;
  internal_plans_subscription_id: string | null;
};

type SpecialtyPlanLookup = { externalSpecializationId: number; planIds: number[] };

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

const PLAN_ID_BY_CODE: Record<string, number> = { psychology: 1, weight_loss: 2, family: 3 };

function normalizeString(value: unknown) { return String(value ?? '').trim(); }
function normalizePlanId(value: unknown, planCode = '') {
  const parsed = Number(value || 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : PLAN_ID_BY_CODE[planCode] || null;
}

async function listActivePlanOrders(client: SupabaseClient, appUserId: string) {
  const { data, error } = await client
    .from('plan_subscription_orders')
    .select('id, plan_code, external_plan_id, external_key, plans_service_subscription_id, internal_plans_subscription_id')
    .or(`app_user_id.eq.${appUserId},patient_id.eq.${appUserId}`)
    .eq('status', 'active')
    .order('activated_at', { ascending: false, nullsFirst: false })
    .limit(10);

  if (error) {
    throw new AppError({ status: 500, code: 'PLAN_ORDERS_LOOKUP_FAILED', message: 'Unable to load patient active plan orders.', details: error.message });
  }
  return (data as ActivePlanOrderRow[] | null) || [];
}

export async function resolvePlanCoverage({ client, appUserId, fallbackExternalKey, specialtyCode, flow, legacyPlanId }: {
  client: SupabaseClient;
  appUserId: string;
  fallbackExternalKey: string;
  specialtyCode: string;
  flow: 'appointment_specialty' | 'on_duty';
  legacyPlanId?: number | null;
}): Promise<PlanCoverageVerification | null> {
  const normalizedSpecialty = normalizePricingSpecialty(specialtyCode);
  const lookup = SPECIALTY_PLAN_LOOKUPS[normalizedSpecialty] || null;
  if (!lookup) return null;

  const orders = await listActivePlanOrders(client, appUserId);
  const plans = getPlansFacade(client);

  const planIds = legacyPlanId ? [legacyPlanId] : lookup.planIds;
  for (const planId of planIds) {
    const order = orders.find((candidate) => normalizePlanId(candidate.external_plan_id, candidate.plan_code) === planId);
    const externalKey = normalizeString(order?.external_key) || normalizeString(fallbackExternalKey);
    if (!order?.id || !order.internal_plans_subscription_id || !externalKey) continue;

    const score = await plans.findAvailableSubscriptionScore({
      externalKey,
      legacyPlanId: planId,
      legacySpecializationId: lookup.externalSpecializationId,
    });
    if (!score || score.subscriptionId !== order.internal_plans_subscription_id) continue;

    const requestSnapshot = {
      provider: 'internal', flow, specialty_code: normalizedSpecialty, plan_id: planId,
      legacy_specialization_id: lookup.externalSpecializationId, plan_subscription_order_id: order.id,
    };
    const responseSnapshot = {
      provider: 'internal', subscription_id: score.subscriptionId,
      subscription_score_id: score.subscriptionScoreId, score_id: score.scoreId,
      plan_code: score.planCode, legacy_plan_id: score.legacyPlanId,
      legacy_specialization_id: score.legacySpecializationId, status: score.status, raw_status: score.rawStatus,
    };

    logTechnicalEvent('info', {
      functionName: 'plans-coverage', operation: 'plan_coverage.lookup',
      resourceType: 'plan_subscription_score', resourceId: score.subscriptionScoreId,
      status: 'available', provider: 'internal',
    });

    return {
      covered: true, reason: 'plan_credit_available', specialtyCode: normalizedSpecialty,
      planSubscriptionOrderId: order.id, internalSubscriptionId: score.subscriptionId,
      internalSubscriptionScoreId: score.subscriptionScoreId, internalScoreId: score.scoreId,
      plansServiceSubscriptionId: order.plans_service_subscription_id,
      externalSubscriptionId: null, externalSubscriptionScoreId: null, externalScoreId: null,
      externalPlanId: score.legacyPlanId, externalSpecializationId: score.legacySpecializationId,
      rawStatus: score.rawStatus, requestSnapshot, responseSnapshot,
    };
  }

  return null;
}
