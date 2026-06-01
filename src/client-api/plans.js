import { invokeEdgeFunction } from './edgeFunctions';

function pickFirstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function normalizePlanCheckout(result = {}) {
  const payment = result?.payment || {};
  const order = result?.order || {};

  return {
    checkoutUrl: pickFirstDefined(result.checkoutUrl, result.checkout_url, payment.checkoutUrl, payment.checkout_url, ''),
    reusedExistingOrder: Boolean(pickFirstDefined(result.reusedExistingOrder, result.reused_existing_order, false)),
    order: {
      id: pickFirstDefined(order.id, order.order_id, null),
      planCode: pickFirstDefined(order.planCode, order.plan_code, ''),
      planLabel: pickFirstDefined(order.planLabel, order.plan_label, ''),
      externalPlanId: pickFirstDefined(order.externalPlanId, order.external_plan_id, null),
      amount: Number(pickFirstDefined(order.amount, 0)),
      currency: pickFirstDefined(order.currency, 'BRL'),
      status: pickFirstDefined(order.status, ''),
      paymentStatus: pickFirstDefined(order.paymentStatus, order.payment_status, ''),
      currentPaymentChargeId: pickFirstDefined(
        order.currentPaymentChargeId,
        order.current_payment_charge_id,
        payment.paymentChargeId,
        payment.payment_charge_id,
        null,
      ),
    },
    payment: {
      paymentChargeId: pickFirstDefined(payment.paymentChargeId, payment.payment_charge_id, null),
      providerChargeId: pickFirstDefined(payment.providerChargeId, payment.provider_charge_id, null),
      status: pickFirstDefined(payment.status, ''),
      provider: pickFirstDefined(payment.provider, ''),
      amount: Number(pickFirstDefined(payment.amount, order.amount, 0)),
      currency: pickFirstDefined(payment.currency, order.currency, 'BRL'),
      checkoutUrl: pickFirstDefined(payment.checkoutUrl, payment.checkout_url, result.checkoutUrl, result.checkout_url, ''),
      reusedExisting: Boolean(pickFirstDefined(payment.reusedExisting, payment.reused_existing, false)),
    },
  };
}

function normalizeString(value) {
  return String(value ?? '').trim();
}

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCredit(item = {}) {
  const code = normalizeString(item.code ?? item.id);

  if (!code) {
    return null;
  }

  return {
    id: code,
    code,
    label: normalizeString(item.label) || code,
    included: Boolean(item.included),
    available: toNumber(item.available),
    used: toNumber(item.used),
    disabled: toNumber(item.disabled),
    total: toNumber(item.total),
    source: normalizeString(item.source),
    specializationId: item.specializationId ?? item.specialization_id ?? null,
    scoreIds: Array.isArray(item.scoreIds ?? item.score_ids) ? (item.scoreIds ?? item.score_ids) : [],
    subscriptionScoreIds: Array.isArray(item.subscriptionScoreIds ?? item.subscription_score_ids)
      ? (item.subscriptionScoreIds ?? item.subscription_score_ids)
      : [],
  };
}

function normalizeCoverage(coverage = {}) {
  return {
    included: Array.isArray(coverage.included) ? coverage.included.map(normalizeString).filter(Boolean) : [],
    notIncluded: Array.isArray(coverage.notIncluded ?? coverage.not_included)
      ? (coverage.notIncluded ?? coverage.not_included).map(normalizeString).filter(Boolean)
      : [],
    source: normalizeString(coverage.source),
  };
}

function normalizeDependents(dependents = {}) {
  return {
    enabled: Boolean(dependents.enabled),
    holderName: normalizeString(dependents.holderName ?? dependents.holder_name ?? dependents.holder),
    used: toNumber(dependents.used ?? dependents.current),
    limit: toNumber(dependents.limit ?? dependents.max),
    items: Array.isArray(dependents.items ?? dependents.list) ? (dependents.items ?? dependents.list) : [],
    source: normalizeString(dependents.source),
  };
}

function normalizeCurrentPlan(currentPlan = null) {
  if (!currentPlan?.id) {
    return null;
  }

  return {
    id: currentPlan.id,
    planCode: normalizeString(currentPlan.planCode ?? currentPlan.plan_code),
    name: normalizeString(currentPlan.name),
    status: normalizeString(currentPlan.status),
    paymentStatus: normalizeString(currentPlan.paymentStatus ?? currentPlan.payment_status),
    amount: toNumber(currentPlan.amount),
    currency: normalizeString(currentPlan.currency) || 'BRL',
    createdAt: normalizeString(currentPlan.createdAt ?? currentPlan.created_at),
    paidAt: normalizeString(currentPlan.paidAt ?? currentPlan.paid_at),
    activatedAt: normalizeString(currentPlan.activatedAt ?? currentPlan.activated_at),
    nextRenewalAt: normalizeString(currentPlan.nextRenewalAt ?? currentPlan.next_renewal_at),
    renewalDayLabel: normalizeString(currentPlan.renewalDayLabel ?? currentPlan.renewal_day_label),
    externalPlanId: currentPlan.externalPlanId ?? currentPlan.external_plan_id ?? null,
    plansServiceSubscriptionId: currentPlan.plansServiceSubscriptionId ?? currentPlan.plans_service_subscription_id ?? null,
    paymentRequired: Boolean(currentPlan.paymentRequired ?? currentPlan.payment_required),
    currentPaymentChargeId: currentPlan.currentPaymentChargeId ?? currentPlan.current_payment_charge_id ?? null,
    error: currentPlan.error || null,
  };
}

function normalizeMyPlans(result = {}) {
  const currentPlan = normalizeCurrentPlan(result.currentPlan ?? result.current_plan);

  return {
    state: normalizeString(result.state) || 'no_plan',
    currentPlan,
    credits: Array.isArray(result.credits)
      ? result.credits.map(normalizeCredit).filter(Boolean)
      : [],
    coverage: normalizeCoverage(result.coverage),
    usageHistory: Array.isArray(result.usageHistory ?? result.usage_history)
      ? (result.usageHistory ?? result.usage_history)
      : [],
    dependents: normalizeDependents(result.dependents),
    creditsSource: normalizeString(result.creditsSource ?? result.credits_source ?? result.sources?.credits),
    creditsSourceReason: normalizeString(result.creditsSourceReason ?? result.credits_source_reason),
    creditsLastSyncedAt: normalizeString(result.creditsLastSyncedAt ?? result.credits_last_synced_at),
    actions: {
      canContractNewPlan: Boolean(result.actions?.canContractNewPlan ?? result.actions?.can_contract_new_plan ?? true),
      canRetryActivation: Boolean(result.actions?.canRetryActivation ?? result.actions?.can_retry_activation),
      canAddDependent: Boolean(result.actions?.canAddDependent ?? result.actions?.can_add_dependent),
    },
    sources: result.sources || {},
  };
}

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

export async function createPlanCheckout(planCode) {
  const result = await invokeEdgeFunction('create-plan-checkout', {
    body: {
      plan_code: planCode,
    },
    fallbackMessage: 'Nao foi possivel iniciar a contratacao do plano.',
  });

  return normalizePlanCheckout(result);
}

export async function getMyPlans() {
  const result = await invokeEdgeFunction('get-my-plans', {
    body: {},
    fallbackMessage: 'Nao foi possivel carregar seus planos.',
  });

  return normalizeMyPlans(result);
}
