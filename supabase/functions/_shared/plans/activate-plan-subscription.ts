import { AppError, isAppError } from '../errors.ts';
import { InternalNotificationService } from '../notifications/InternalNotificationService.ts';
import { notifyInternalBestEffort } from '../notifications/notify-best-effort.ts';
import { logTechnicalEvent } from '../observability.ts';
import type { SupabaseClient } from '../supabase.ts';
import type { ActivatePlanSubscriptionInput, PlanCode } from './contracts/types.ts';
import { getPlansFacade } from './facade.ts';

type PaymentChargeRow = {
  id: string; owner_type: string; owner_id: string; status: string;
  provider: string | null; paid_at: string | null;
};
type PlanSubscriptionOrderRow = {
  id: string; patient_id: string | null; app_user_id: string | null; plan_code: string;
  status: string; payment_status: string | null; current_payment_charge_id: string | null;
  plans_service_subscription_id: string | null; internal_plans_subscription_id: string | null;
  external_key: string | null; paid_at: string | null;
};
type AppUserRow = { id: string; full_name: string | null; email: string | null; cpf: string | null };

export type PlanActivationResult = {
  skipped: boolean;
  activated: boolean;
  orderId: string;
  paymentChargeId: string;
  status: string;
  reason: string;
  plansServiceSubscriptionId: string | null;
  internalSubscriptionId?: string | null;
  jobId?: string | null;
  errorCode?: string;
  errorMessage?: string;
};

function text(value: unknown) { return String(value ?? '').trim(); }
function planCode(value: unknown): PlanCode {
  const normalized = text(value);
  if (normalized === 'psychology' || normalized === 'weight_loss' || normalized === 'family') return normalized;
  throw new AppError({ status: 422, code: 'PLAN_CODE_INVALID', message: 'Plan order has an invalid plan code.' });
}
function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts.shift() || '', lastName: parts.join(' ') };
}

async function loadCharge(client: SupabaseClient, id: string) {
  const { data, error } = await client.from('payment_charges')
    .select('id, owner_type, owner_id, status, provider, paid_at').eq('id', id).maybeSingle();
  if (error) throw new AppError({ status: 500, code: 'PAYMENT_CHARGE_LOOKUP_FAILED', message: 'Unable to load payment charge for plan activation.', details: error.message });
  if (!(data as PaymentChargeRow | null)?.id) throw new AppError({ status: 404, code: 'PAYMENT_CHARGE_NOT_FOUND', message: 'Payment charge was not found for plan activation.' });
  return data as PaymentChargeRow;
}

async function loadOrder(client: SupabaseClient, id: string) {
  const { data, error } = await client.from('plan_subscription_orders').select(`
    id, patient_id, app_user_id, plan_code, status, payment_status, current_payment_charge_id,
    plans_service_subscription_id, internal_plans_subscription_id, external_key, paid_at
  `).eq('id', id).maybeSingle();
  if (error) throw new AppError({ status: 500, code: 'PLAN_ORDER_LOOKUP_FAILED', message: 'Unable to load plan order for activation.', details: error.message });
  if (!(data as PlanSubscriptionOrderRow | null)?.id) throw new AppError({ status: 404, code: 'PLAN_ORDER_NOT_FOUND', message: 'Plan order was not found for activation.' });
  return data as PlanSubscriptionOrderRow;
}

async function loadAppUser(client: SupabaseClient, id: string) {
  const { data, error } = await client.from('app_users').select('id, full_name, email, cpf').eq('id', id).maybeSingle();
  if (error || !(data as AppUserRow | null)?.id) throw new AppError({ status: error ? 500 : 404, code: 'PLAN_ACTIVATION_APP_USER_NOT_FOUND', message: 'Patient was not found for plan activation.' });
  return data as AppUserRow;
}

function buildInput(order: PlanSubscriptionOrderRow, charge: PaymentChargeRow, user: AppUserRow): ActivatePlanSubscriptionInput {
  const email = text(user.email || order.external_key);
  const externalKey = text(order.external_key || email);
  if (!externalKey || !email) throw new AppError({ status: 422, code: 'PLAN_ACTIVATION_EXTERNAL_KEY_MISSING', message: 'Patient email is required to activate a plan.' });
  const name = splitName(text(user.full_name));
  return {
    planSubscriptionOrderId: order.id,
    paymentChargeId: charge.id,
    externalKey,
    planCode: planCode(order.plan_code),
    paidAt: charge.paid_at || order.paid_at || new Date().toISOString(),
    customer: { email, first_name: name.firstName, last_name: name.lastName, document: text(user.cpf).replace(/\D/g, '') },
    metadata: { source: 'rapido_doutor', provider: 'internal', order_id: order.id, payment_charge_id: charge.id },
  };
}

export async function activatePlanSubscriptionForPayment(client: SupabaseClient, {
  paymentChargeId, requestId = '', retry = false,
}: { paymentChargeId: string; requestId?: string; retry?: boolean }): Promise<PlanActivationResult> {
  const charge = await loadCharge(client, paymentChargeId);
  if (charge.owner_type !== 'plan_subscription') {
    return { skipped: true, activated: false, orderId: charge.owner_id, paymentChargeId: charge.id, status: '', reason: 'owner_type_not_plan_subscription', plansServiceSubscriptionId: null };
  }
  const order = await loadOrder(client, charge.owner_id);
  if (order.status === 'active') {
    return { skipped: true, activated: true, orderId: order.id, paymentChargeId: charge.id, status: 'active', reason: 'already_active', plansServiceSubscriptionId: order.plans_service_subscription_id, internalSubscriptionId: order.internal_plans_subscription_id };
  }
  if (charge.status !== 'paid') {
    return { skipped: true, activated: false, orderId: order.id, paymentChargeId: charge.id, status: order.status, reason: 'payment_not_paid', plansServiceSubscriptionId: null };
  }

  const recipientUserId = text(order.app_user_id || order.patient_id);
  try {
    if (!recipientUserId) throw new AppError({ status: 422, code: 'PLAN_ACTIVATION_APP_USER_MISSING', message: 'Plan order does not have a linked patient.' });
    const input = buildInput(order, charge, await loadAppUser(client, recipientUserId));
    const { error } = await client.from('plan_subscription_orders').update({
      status: 'activating_plan', payment_status: 'paid', current_payment_charge_id: charge.id,
      paid_at: input.paidAt, plans_backend: 'internal', request_snapshot: input,
      error_code: null, error_message: null,
    }).eq('id', order.id);
    if (error) throw new AppError({ status: 500, code: 'PLAN_ORDER_ACTIVATING_UPDATE_FAILED', message: 'Unable to mark plan order as activating.', details: error.message });

    const job = await getPlansFacade(client).enqueueActivation(input, retry);
    logTechnicalEvent('info', {
      functionName: 'plan-activation', requestId, operation: 'plan_subscription.enqueue',
      resourceType: 'plan_subscription_order', resourceId: order.id, status: 'activating_plan', provider: 'internal',
    });
    return {
      skipped: false, activated: false, orderId: order.id, paymentChargeId: charge.id,
      status: 'activating_plan', reason: 'activation_queued', plansServiceSubscriptionId: null,
      internalSubscriptionId: null, jobId: text(job.id) || null,
    };
  } catch (error) {
    const appError = isAppError(error) ? error : new AppError({ status: 500, code: 'PLAN_ACTIVATION_ENQUEUE_FAILED', message: 'Unable to enqueue plan activation.' });
    await client.from('plan_subscription_orders').update({
      status: 'activation_failed', payment_status: 'paid', plans_backend: 'internal',
      error_code: appError.code, error_message: appError.message,
    }).eq('id', order.id).neq('status', 'active');
    if (recipientUserId) {
      await notifyInternalBestEffort({
        notificationService: new InternalNotificationService(client), functionName: 'plan-activation', requestId,
        input: { recipientUserId, typeKey: 'plan.activation_failed', relatedEntityType: 'plan', relatedEntityId: order.id, deduplicationKey: `plan_order:${order.id}:activation_failed:${recipientUserId}` },
      });
    }
    return {
      skipped: false, activated: false, orderId: order.id, paymentChargeId: charge.id,
      status: 'activation_failed', reason: 'activation_failed', plansServiceSubscriptionId: null,
      errorCode: appError.code, errorMessage: appError.message,
    };
  }
}
