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
