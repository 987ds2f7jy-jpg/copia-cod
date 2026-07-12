import { env } from '@/config/env';
import { invokeEdgeFunction } from './edgeFunctions';

const PAYMENT_STATUS_LABELS = {
  payment_pending: {
    label: 'Aguardando pagamento',
    description: 'Conclua o checkout seguro para liberar a proxima etapa.',
    tone: 'amber',
  },
  payment_processing: {
    label: 'Pagamento em processamento',
    description: 'Estamos aguardando a confirmacao do provedor de pagamento.',
    tone: 'blue',
  },
  paid: {
    label: 'Pagamento confirmado',
    description: 'Pagamento confirmado pelo backend.',
    tone: 'emerald',
  },
  payment_failed: {
    label: 'Pagamento recusado',
    description: 'Nao foi possivel confirmar o pagamento. Tente novamente.',
    tone: 'red',
  },
  payment_expired: {
    label: 'Pagamento expirado',
    description: 'A cobranca expirou. Gere uma nova tentativa para continuar.',
    tone: 'red',
  },
  refunded: {
    label: 'Pagamento estornado',
    description: 'Este pagamento foi estornado.',
    tone: 'gray',
  },
  chargeback: {
    label: 'Chargeback registrado',
    description: 'Este pagamento foi contestado.',
    tone: 'red',
  },
};

const PAYMENT_PROVIDER_LABELS = {
  mock: 'Ambiente interno',
  mercadopago: 'Mercado Pago',
  stripe: 'Stripe',
};

function pickFirstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

export function formatMoney(value, currency = 'BRL') {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function normalizePayment(payment = null, owner = null) {
  if (!payment && !owner) {
    return null;
  }

  const paymentChargeId = pickFirstDefined(
    payment?.paymentChargeId,
    payment?.payment_charge_id,
    owner?.currentPaymentChargeId,
    owner?.current_payment_charge_id,
  );
  const status = pickFirstDefined(
    payment?.status,
    owner?.paymentStatus,
    owner?.payment_status,
  );
  const amount = pickFirstDefined(
    payment?.amount,
    owner?.grossPrice,
    owner?.gross_price,
    owner?.quotedGrossPrice,
    owner?.quoted_gross_price,
    owner?.price,
  );

  if (!paymentChargeId && !status && !amount) {
    return null;
  }

  return {
    paymentChargeId: paymentChargeId || null,
    externalReference: pickFirstDefined(payment?.externalReference, payment?.external_reference, null),
    providerIdempotencyKey: pickFirstDefined(payment?.providerIdempotencyKey, payment?.provider_idempotency_key, null),
    provider: pickFirstDefined(payment?.provider, null),
    providerChargeId: pickFirstDefined(payment?.providerChargeId, payment?.provider_charge_id, null),
    checkoutUrl: pickFirstDefined(payment?.checkoutUrl, payment?.checkout_url, payment?.provider_checkout_url, ''),
    paymentReference: pickFirstDefined(payment?.paymentReference, payment?.payment_reference, null),
    status: status || 'payment_pending',
    attemptNumber: Number(pickFirstDefined(payment?.attemptNumber, payment?.attempt_number, 1)),
    amount: Number(amount || 0),
    currency: pickFirstDefined(payment?.currency, owner?.currency, 'BRL'),
    paidAt: pickFirstDefined(payment?.paidAt, payment?.paid_at, owner?.paidAt, owner?.paid_at, null),
    reusedExisting: Boolean(pickFirstDefined(payment?.reusedExisting, payment?.reused_existing, false)),
  };
}

export function getPaymentStatusInfo(status) {
  return PAYMENT_STATUS_LABELS[status] || PAYMENT_STATUS_LABELS.payment_pending;
}

export function formatPaymentProviderName(provider) {
  const normalized = String(provider || '').trim().toLowerCase();

  if (!normalized) {
    return 'Plataforma';
  }

  return PAYMENT_PROVIDER_LABELS[normalized] || provider;
}

export async function ensurePaymentChargeRequest({
  ownerType = '',
  ownerId = '',
}) {
  const result = await invokeEdgeFunction('ensure-payment-charge', {
    body: {
      ownerType,
      ownerId,
    },
    fallbackMessage: 'Nao foi possivel preparar o checkout do pagamento.',
  });

  return normalizePayment(result?.payment || result);
}

export async function getPaymentStatusRequest({ chargeId = '' }) {
  return invokeEdgeFunction('get-payment-status', {
    body: { chargeId },
    fallbackMessage: 'Nao foi possivel consultar o status do pagamento.',
  });
}

export function canUsePaymentSimulation() {
  return Boolean(env.paymentSimulationEnabled);
}

export async function simulatePaymentPaidRequest({
  paymentChargeId = '',
  ownerType = '',
  ownerId = '',
}) {
  if (!canUsePaymentSimulation()) {
    const error = new Error('Simulacao de pagamento indisponivel neste ambiente.');
    error.code = 'PAYMENT_SIMULATION_UNAVAILABLE';
    throw error;
  }

  return invokeEdgeFunction('simulate-payment-paid', {
    body: {
      paymentChargeId,
      ownerType,
      ownerId,
    },
    fallbackMessage: 'Nao foi possivel simular o pagamento.',
  });
}
