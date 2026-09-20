import { AppError } from '../errors.ts';
import { InternalNotificationService } from '../notifications/InternalNotificationService.ts';
import {
  logInternalNotificationFailure,
  notifyInternalBestEffort,
} from '../notifications/notify-best-effort.ts';
import type { SupabaseClient } from '../supabase.ts';
import type { PaymentOwnerType } from './types.ts';

const OWNER_TABLE: Record<PaymentOwnerType, string> = {
  appointment: 'appointments',
  queue: 'queues',
  solicitacao_exame: 'solicitacoes_exames',
  plan_subscription: 'plan_subscription_orders',
};

async function resolvePaymentOwnerRecipientUserId(
  client: SupabaseClient,
  ownerType: PaymentOwnerType,
  ownerId: string,
) {
  const select = ownerType === 'plan_subscription'
    ? 'id, app_user_id, patient_id'
    : ownerType === 'solicitacao_exame'
    ? 'id, paciente_id'
    : 'id, patient_id';
  const { data, error } = await client
    .from(OWNER_TABLE[ownerType])
    .select(select)
    .eq('id', ownerId)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_NOTIFICATION_RECIPIENT_LOOKUP_FAILED',
      message: 'Unable to resolve payment notification recipient.',
      details: error.message,
    });
  }

  const owner = data as {
    id?: string;
    app_user_id?: string | null;
    patient_id?: string | null;
    paciente_id?: string | null;
  } | null;
  const recipientUserId = String(
    owner?.app_user_id || owner?.patient_id || owner?.paciente_id || '',
  ).trim();

  if (!owner?.id || !recipientUserId) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_NOTIFICATION_RECIPIENT_NOT_FOUND',
      message: 'Unable to resolve payment notification recipient.',
    });
  }

  return recipientUserId;
}

export async function notifyPaymentApprovedBestEffort(
  client: SupabaseClient,
  {
    paymentChargeId,
    ownerType,
    ownerId,
    requestId,
    functionName,
  }: {
    paymentChargeId: string;
    ownerType: PaymentOwnerType;
    ownerId: string;
    requestId?: string | null;
    functionName: string;
  },
) {
  let recipientUserId: string | null = null;
  let deduplicationKey = `payment_charge:${paymentChargeId}:approved:unresolved`;

  try {
    recipientUserId = await resolvePaymentOwnerRecipientUserId(client, ownerType, ownerId);
    deduplicationKey = `payment_charge:${paymentChargeId}:approved:${recipientUserId}`;
  } catch (error) {
    logInternalNotificationFailure({
      functionName,
      requestId,
      typeKey: 'financial.payment_approved',
      recipientUserId,
      relatedEntityType: 'payment_charge',
      relatedEntityId: paymentChargeId,
      deduplicationKey,
    }, error);
    return false;
  }

  return notifyInternalBestEffort({
    notificationService: new InternalNotificationService(client),
    functionName,
    requestId,
    input: {
      recipientUserId,
      typeKey: 'financial.payment_approved',
      relatedEntityType: 'payment_charge',
      relatedEntityId: paymentChargeId,
      deduplicationKey,
    },
  });
}
