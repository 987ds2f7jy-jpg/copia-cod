import { invokeEdgeFunction } from './edgeFunctions';

function toTrimmedString(value) {
  return String(value ?? '').trim();
}

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePaymentItem(item) {
  if (!item) {
    return null;
  }

  const id = toTrimmedString(item.id ?? item.payment_charge_id);
  if (!id) {
    return null;
  }

  return {
    id,
    owner_type: toTrimmedString(item.owner_type ?? item.ownerType),
    owner_id: toTrimmedString(item.owner_id ?? item.ownerId),
    attempt_number: Number(item.attempt_number ?? item.attemptNumber ?? 1),
    is_current: Boolean(item.is_current ?? item.isCurrent),
    status: toTrimmedString(item.status) || 'payment_pending',
    amount: toNumber(item.amount),
    currency: toTrimmedString(item.currency) || 'BRL',
    provider: toTrimmedString(item.provider),
    checkout_url: toTrimmedString(item.checkout_url ?? item.checkoutUrl),
    external_reference: toTrimmedString(item.external_reference ?? item.externalReference),
    failure_reason: toTrimmedString(item.failure_reason ?? item.failureReason),
    created_at: toTrimmedString(item.created_at ?? item.createdAt),
    updated_at: toTrimmedString(item.updated_at ?? item.updatedAt),
    paid_at: toTrimmedString(item.paid_at ?? item.paidAt),
    failed_at: toTrimmedString(item.failed_at ?? item.failedAt),
    expires_at: toTrimmedString(item.expires_at ?? item.expiresAt),
    expired_at: toTrimmedString(item.expired_at ?? item.expiredAt),
    refunded_at: toTrimmedString(item.refunded_at ?? item.refundedAt),
    chargeback_at: toTrimmedString(item.chargeback_at ?? item.chargebackAt),
    service_code: toTrimmedString(item.service_code ?? item.serviceCode),
    service_type: toTrimmedString(item.service_type ?? item.serviceType) || 'Pagamento',
    specialty: toTrimmedString(item.specialty),
    professional_name: toTrimmedString(item.professional_name ?? item.professionalName),
    patient_name: toTrimmedString(item.patient_name ?? item.patientName),
    operational_status: toTrimmedString(item.operational_status ?? item.operationalStatus),
  };
}

function normalizeSummary(summary = {}) {
  return {
    total_paid: toNumber(summary.total_paid ?? summary.totalPaid),
    total_pending: toNumber(summary.total_pending ?? summary.totalPending),
    total_failed: toNumber(summary.total_failed ?? summary.totalFailed),
    count: Number(summary.count || 0),
  };
}

export async function getPatientPaymentsRequest({ limit = 100 } = {}) {
  const result = await invokeEdgeFunction('get-patient-payments', {
    body: { limit },
    fallbackMessage: 'Nao foi possivel carregar seus pagamentos.',
  });

  const items = Array.isArray(result?.items)
    ? result.items.map(normalizePaymentItem).filter(Boolean)
    : [];

  return {
    items,
    summary: normalizeSummary(result?.summary),
  };
}
