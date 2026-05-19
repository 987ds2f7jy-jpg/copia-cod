import { invokeEdgeFunction } from './edgeFunctions';

export async function checkPlanCoverage(payload = {}) {
  const result = await invokeEdgeFunction('check-plan-coverage', {
    body: payload,
    fallbackMessage: 'Nao foi possivel verificar a cobertura do plano.',
  });

  return {
    covered: Boolean(result?.covered),
    fundingSource: result?.funding_source || 'self_pay',
    reason: result?.reason || 'plans_service_unavailable',
    specialtyCode: result?.specialty_code || '',
    externalSpecializationId: result?.external_specialization_id ?? null,
    externalPlanId: result?.external_plan_id ?? null,
    externalSubscriptionId: result?.external_subscription_id ?? null,
    externalSubscriptionScoreId: result?.external_subscription_score_id ?? null,
    externalScoreId: result?.external_score_id ?? null,
    rawStatus: result?.raw_status ?? null,
    message: result?.message || 'Fluxo avulso permanece disponivel.',
  };
}
