import { invokeEdgeFunction } from './edgeFunctions';
import { normalizePayment } from './payments';

function normalizeQueueEntry(queueEntry, payment = null) {
  if (!queueEntry) {
    return null;
  }

  const normalized = {
    ...queueEntry,
    estimatedWaitTime: queueEntry.estimatedWaitTime ?? queueEntry.estimated_wait_time ?? 0,
    assignedProfessionalId: queueEntry.assignedProfessionalId ?? queueEntry.assigned_professional_id ?? '',
    solicitacaoExameId: queueEntry.solicitacaoExameId ?? queueEntry.solicitacao_exame_id ?? '',
    serviceCode: queueEntry.serviceCode ?? queueEntry.service_code ?? '',
    quotedGrossPrice: queueEntry.quotedGrossPrice ?? queueEntry.quoted_gross_price ?? 0,
    paymentStatus: queueEntry.paymentStatus ?? queueEntry.payment_status ?? 'payment_pending',
    paymentRequired: queueEntry.paymentRequired ?? queueEntry.payment_required ?? true,
    currentPaymentChargeId: queueEntry.currentPaymentChargeId ?? queueEntry.current_payment_charge_id ?? null,
    fundingSource: queueEntry.fundingSource ?? queueEntry.funding_source ?? 'self_pay',
    coverageStatus: queueEntry.coverageStatus ?? queueEntry.coverage_status ?? null,
    planCreditUsageId: queueEntry.planCreditUsageId ?? queueEntry.plan_credit_usage_id ?? null,
  };
  const normalizedPayment = normalizePayment(payment || queueEntry.payment, normalized);

  return {
    ...normalized,
    estimated_wait_time: normalized.estimatedWaitTime,
    assigned_professional_id: normalized.assignedProfessionalId,
    solicitacao_exame_id: normalized.solicitacaoExameId,
    service_code: normalized.serviceCode,
    quoted_gross_price: normalized.quotedGrossPrice,
    payment_status: normalized.paymentStatus,
    payment_required: normalized.paymentRequired,
    current_payment_charge_id: normalized.currentPaymentChargeId,
    funding_source: normalized.fundingSource,
    coverage_status: normalized.coverageStatus,
    plan_credit_usage_id: normalized.planCreditUsageId,
    payment: normalizedPayment,
  };
}

export async function joinQueueEntry({
  specialty,
  symptoms = '',
  priorityLevel = 'normal',
  solicitacaoExameId = '',
}) {
  const result = await invokeEdgeFunction('join-queue', {
    body: {
      specialty,
      symptoms,
      priorityLevel,
      solicitacaoExameId,
    },
    fallbackMessage: 'Nao foi possivel entrar na fila.',
  });

  return {
    ...result,
    payment: normalizePayment(result?.payment, result?.queueEntry),
    queueEntry: normalizeQueueEntry(result?.queueEntry, result?.payment),
  };
}

export async function leaveQueueEntry({ queueId = null } = {}) {
  const result = await invokeEdgeFunction('leave-queue', {
    body: {
      queueId,
    },
    fallbackMessage: 'Nao foi possivel sair da fila.',
  });

  return {
    ...result,
    queueEntry: normalizeQueueEntry(result?.queueEntry),
  };
}

export async function acceptQueueEntryRequest({ queueId }) {
  const result = await invokeEdgeFunction('accept-queue-entry', {
    body: {
      queueId,
    },
    fallbackMessage: 'Nao foi possivel aceitar o paciente da fila.',
  });

  return {
    ...result,
    queue: normalizeQueueEntry(result?.queue),
  };
}
