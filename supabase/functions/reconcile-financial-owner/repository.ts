import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { insertAuditEvent } from '../_shared/observability.ts';
import { markPaymentAsPaid } from '../_shared/payments/mark-payment-as-paid.ts';
import { createPaymentProvider } from '../_shared/payments/providers/index.ts';
import { listExternalPlanScores } from '../_shared/plans-service/client.ts';
import { requireAppUserByAuthUserId, requireRole } from '../_shared/professional.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  ReconciliationIssue,
  ReconciliationOwnerType,
  ReconciliationStepResult,
  ReconcileFinancialOwnerRepository,
} from './types.ts';
import { resolveExternalCreditStatus } from './service.ts';

type PaymentChargeRow = {
  id: string;
  owner_type: ReconciliationOwnerType;
  owner_id: string;
  provider: string;
  status: string;
  amount: number | string;
  currency: string;
  provider_charge_id: string | null;
  provider_payment_reference: string | null;
};

type PlanOwnerRow = {
  id: string;
  funding_source: string;
  coverage_status: string | null;
  plan_credit_usage_id: string | null;
};

type PlanUsageRow = {
  id: string;
  status: string;
  external_subscription_score_id: string | null;
  plan_subscription_order_id: string | null;
};

const OWNER_AMOUNT: Record<ReconciliationOwnerType, { table: string; field: string }> = {
  appointment: { table: 'appointments', field: 'gross_price' },
  queue: { table: 'queues', field: 'quoted_gross_price' },
  solicitacao_exame: { table: 'solicitacoes_exames', field: 'quoted_gross_price' },
  plan_subscription: { table: 'plan_subscription_orders', field: 'amount' },
};

function money(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : 0;
}

function normalized(value: unknown) {
  return String(value ?? '').trim();
}

async function listIssues(client: SupabaseClient, ownerType: ReconciliationOwnerType, ownerId: string) {
  const { data, error } = await client
    .from('system_reconciliation_queue')
    .select('issue_type, reason_code')
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .limit(100);

  if (error) {
    throw new AppError({ status: 500, code: 'RECONCILIATION_ISSUES_LOAD_FAILED', message: 'Unable to load reconciliation state.' });
  }

  return (data as ReconciliationIssue[] | null) || [];
}

async function loadLatestCharge(client: SupabaseClient, ownerType: ReconciliationOwnerType, ownerId: string) {
  const { data, error } = await client
    .from('payment_charges')
    .select('id, owner_type, owner_id, provider, status, amount, currency, provider_charge_id, provider_payment_reference')
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    throw new AppError({ status: 500, code: 'PAYMENT_CHARGE_LOOKUP_FAILED', message: 'Unable to load the payment charge.' });
  }

  const rows = (data as PaymentChargeRow[] | null) || [];
  return rows.find((row) => row.status === 'paid')
    || rows.find((row) => row.status === 'payment_processing')
    || rows.find((row) => row.status === 'payment_pending')
    || rows[0]
    || null;
}

async function loadOwnerAmount(
  client: SupabaseClient,
  ownerType: ReconciliationOwnerType,
  ownerId: string,
) {
  const config = OWNER_AMOUNT[ownerType];
  const { data, error } = await client.from(config.table).select(`id, ${config.field}`).eq('id', ownerId).maybeSingle();
  if (error || !(data as Record<string, unknown> | null)?.id) {
    throw new AppError({ status: 404, code: 'RECONCILIATION_OWNER_NOT_FOUND', message: 'The reconciliation owner was not found.' });
  }
  return money((data as Record<string, unknown>)[config.field]);
}

async function reconcilePayment(
  client: SupabaseClient,
  ownerType: ReconciliationOwnerType,
  ownerId: string,
): Promise<ReconciliationStepResult> {
  const charge = await loadLatestCharge(client, ownerType, ownerId);
  if (!charge) return { attempted: false, changed: false, status: 'manual_review_required', reasonCode: 'PAYMENT_CHARGE_NOT_FOUND' };

  if (ownerType === 'appointment' || ownerType === 'queue') {
    const { data } = await client.from(OWNER_AMOUNT[ownerType].table).select('funding_source').eq('id', ownerId).maybeSingle();
    if (normalized((data as { funding_source?: unknown } | null)?.funding_source) === 'plan') {
      return { attempted: false, changed: false, status: 'manual_review_required', reasonCode: 'PLAN_OWNER_PAYMENT_CHARGE_CONFLICT' };
    }
  }

  if (charge.status === 'paid') {
    await markPaymentAsPaid(client, { paymentChargeId: charge.id });
    return { attempted: true, changed: true, status: 'resolved', reasonCode: 'LOCAL_OWNER_PAYMENT_REPAIRED' };
  }

  if (!['payment_pending', 'payment_processing'].includes(charge.status)) {
    return { attempted: false, changed: false, status: 'manual_review_required', reasonCode: 'PAYMENT_STATUS_NOT_RECONCILABLE' };
  }

  const providerReference = charge.provider === 'mercadopago'
    ? normalized(charge.provider_payment_reference || charge.provider_charge_id)
    : normalized(charge.provider_charge_id || charge.provider_payment_reference);
  if (!providerReference) {
    return { attempted: false, changed: false, status: 'manual_review_required', reasonCode: 'PAYMENT_PROVIDER_REFERENCE_MISSING' };
  }

  let providerStatus;
  try {
    providerStatus = await createPaymentProvider(charge.provider).getChargeStatus(providerReference);
  } catch {
    return { attempted: true, changed: false, status: 'manual_review_required', reasonCode: 'PAYMENT_PROVIDER_RECHECK_FAILED' };
  }

  const ownerAmount = await loadOwnerAmount(client, ownerType, ownerId);
  if (money(providerStatus.amount) !== money(charge.amount) || ownerAmount !== money(charge.amount)
    || normalized(providerStatus.currency).toUpperCase() !== normalized(charge.currency).toUpperCase()) {
    return { attempted: true, changed: false, status: 'manual_review_required', reasonCode: 'PAYMENT_AMOUNT_OR_CURRENCY_MISMATCH' };
  }

  if (providerStatus.status !== 'paid') {
    return { attempted: true, changed: false, status: 'manual_review_required', reasonCode: 'PAYMENT_NOT_CONFIRMED_BY_PROVIDER' };
  }

  const { data: claimed, error } = await client
    .from('payment_charges')
    .update({
      status: 'paid',
      paid_at: providerStatus.paidAt || new Date().toISOString(),
      provider_payment_reference: providerStatus.paymentReference || charge.provider_payment_reference,
      last_provider_status: normalized(providerStatus.rawStatus),
      last_provider_payload: { reconciled: true, provider_status: normalized(providerStatus.rawStatus) },
      failure_reason: '',
    })
    .eq('id', charge.id)
    .in('status', ['payment_pending', 'payment_processing'])
    .select('id')
    .maybeSingle();

  if (error) {
    throw new AppError({ status: 500, code: 'PAYMENT_RECONCILIATION_UPDATE_FAILED', message: 'Unable to apply the verified payment status.' });
  }

  if (!(claimed as { id?: string } | null)?.id) {
    const current = await loadLatestCharge(client, ownerType, ownerId);
    if (current?.status !== 'paid') {
      throw new AppError({ status: 409, code: 'PAYMENT_RECONCILIATION_CONFLICT', message: 'Payment state changed during reconciliation.' });
    }
  }

  await markPaymentAsPaid(client, { paymentChargeId: charge.id });
  return { attempted: true, changed: true, status: 'resolved', reasonCode: 'PAYMENT_CONFIRMED_BY_PROVIDER' };
}

async function reconcilePlanCredit(
  client: SupabaseClient,
  ownerType: ReconciliationOwnerType,
  ownerId: string,
  requestId: string,
): Promise<ReconciliationStepResult> {
  if (ownerType !== 'appointment' && ownerType !== 'queue') {
    return { attempted: false, changed: false, status: 'skipped', reasonCode: 'OWNER_TYPE_NOT_PLAN_COVERED' };
  }

  const { data: ownerData, error: ownerError } = await client
    .from(OWNER_AMOUNT[ownerType].table)
    .select('id, funding_source, coverage_status, plan_credit_usage_id')
    .eq('id', ownerId)
    .maybeSingle();
  if (ownerError || !(ownerData as PlanOwnerRow | null)?.id) {
    throw new AppError({ status: 404, code: 'RECONCILIATION_OWNER_NOT_FOUND', message: 'The reconciliation owner was not found.' });
  }
  const owner = ownerData as PlanOwnerRow;
  if (owner.funding_source !== 'plan' || !owner.plan_credit_usage_id) {
    return { attempted: false, changed: false, status: 'manual_review_required', reasonCode: 'PLAN_OWNER_LINK_INVALID' };
  }

  const { data: usageData, error: usageError } = await client
    .from('plan_credit_usages')
    .select('id, status, external_subscription_score_id, plan_subscription_order_id')
    .eq('id', owner.plan_credit_usage_id)
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (usageError || !(usageData as PlanUsageRow | null)?.id) {
    return { attempted: false, changed: false, status: 'manual_review_required', reasonCode: 'PLAN_CREDIT_USAGE_NOT_FOUND' };
  }
  const usage = usageData as PlanUsageRow;

  if (usage.status === 'used') {
    const { error } = await client.rpc('reconcile_plan_credit_usage_from_external', {
      p_usage_id: usage.id, p_owner_type: ownerType, p_owner_id: ownerId, p_request_id: requestId,
    });
    if (error) throw new AppError({ status: 500, code: 'PLAN_CREDIT_LOCAL_REPAIR_FAILED', message: 'Unable to repair the local plan credit state.' });
    return { attempted: true, changed: owner.coverage_status !== 'plan_used', status: 'resolved', reasonCode: 'LOCAL_PLAN_OWNER_REPAIRED' };
  }

  const externalScoreId = normalized(usage.external_subscription_score_id);
  if (!externalScoreId || !usage.plan_subscription_order_id) {
    return { attempted: false, changed: false, status: 'manual_review_required', reasonCode: 'PLAN_CREDIT_EXTERNAL_ID_MISSING' };
  }

  const { data: orderData, error: orderError } = await client
    .from('plan_subscription_orders')
    .select('id, external_key, plans_service_subscription_id')
    .eq('id', usage.plan_subscription_order_id)
    .maybeSingle();
  const order = orderData as { id?: string; external_key?: string; plans_service_subscription_id?: string } | null;
  if (orderError || !order?.id || !normalized(order.external_key)) {
    return { attempted: false, changed: false, status: 'manual_review_required', reasonCode: 'PLAN_SUBSCRIPTION_IDENTITY_MISSING' };
  }

  let scores;
  try {
    scores = await listExternalPlanScores({
      externalKey: normalized(order.external_key),
      subscriptionId: normalized(order.plans_service_subscription_id) || undefined,
    });
  } catch {
    return { attempted: true, changed: false, status: 'manual_review_required', reasonCode: 'PLANS_SERVICE_RECHECK_FAILED' };
  }

  const externalStatus = resolveExternalCreditStatus(
    scores.subscriptions as Array<{ scores?: Array<Record<string, unknown>> | null }>,
    externalScoreId,
  );
  if (externalStatus !== 'used') {
    return { attempted: true, changed: false, status: 'manual_review_required', reasonCode: 'PLAN_CREDIT_NOT_CONFIRMED_EXTERNALLY' };
  }

  const { error: reconcileError } = await client.rpc('reconcile_plan_credit_usage_from_external', {
    p_usage_id: usage.id, p_owner_type: ownerType, p_owner_id: ownerId, p_request_id: requestId,
  });
  if (reconcileError) {
    throw new AppError({ status: 500, code: 'PLAN_CREDIT_LOCAL_REPAIR_FAILED', message: 'Unable to repair the locally confirmed plan credit.' });
  }

  return { attempted: true, changed: true, status: 'resolved', reasonCode: 'PLAN_CREDIT_CONFIRMED_EXTERNALLY' };
}

export function createReconcileFinancialOwnerRepository(client: SupabaseClient): ReconcileFinancialOwnerRepository {
  return {
    async acquireClaim(input) {
      const { data, error } = await client.rpc('acquire_financial_reconciliation_claim', {
        p_resource_type: input.ownerType,
        p_resource_id: input.ownerId,
        p_request_id: input.requestId,
        p_actor_user_id: input.actorUserId,
        p_lock_seconds: 60,
      });
      if (error) throw new AppError({ status: 500, code: 'RECONCILIATION_CLAIM_FAILED', message: 'Unable to acquire reconciliation lock.' });
      return data === true;
    },
    async releaseClaim(input) {
      await client.rpc('release_financial_reconciliation_claim', {
        p_resource_type: input.ownerType,
        p_resource_id: input.ownerId,
        p_request_id: input.requestId,
      });
    },
    listIssues: (ownerType, ownerId) => listIssues(client, ownerType, ownerId),
    reconcilePayment: (ownerType, ownerId) => reconcilePayment(client, ownerType, ownerId),
    reconcilePlanCredit: (ownerType, ownerId, requestId) => reconcilePlanCredit(client, ownerType, ownerId, requestId),
    async writeAudit(input) {
      await insertAuditEvent(client, {
        actorUserId: input.admin.id,
        actorRole: input.admin.role,
        action: 'financial_owner.reconciliation',
        resourceType: input.ownerType,
        resourceId: input.ownerId,
        outcome: input.outcome,
        errorCode: input.errorCode,
        requestId: `${input.requestId}:${input.outcome}`,
        metadata: {
          issue_type: input.issueType,
          reason_code: input.errorCode,
          owner_type: input.ownerType,
        },
      });
    },
  };
}

export function createReconcileFinancialOwnerRuntime() {
  const client = createServiceRoleClient();
  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    async resolveAdmin(authUserId: string) {
      const appUser = await requireAppUserByAuthUserId(client, authUserId);
      requireRole(appUser, ['admin']);
      return appUser;
    },
    repository: createReconcileFinancialOwnerRepository(client),
  };
}
