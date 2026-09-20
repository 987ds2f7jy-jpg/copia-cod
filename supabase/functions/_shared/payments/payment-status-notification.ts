import { AppError } from '../errors.ts';
import { InternalNotificationService } from '../notifications/InternalNotificationService.ts';
import {
  logInternalNotificationFailure,
  notifyInternalBestEffort,
} from '../notifications/notify-best-effort.ts';
import type { SupabaseClient } from '../supabase.ts';
import type { PaymentChargeStatus, PaymentOwnerType } from './types.ts';

const OWNER_TABLE: Record<PaymentOwnerType, string> = {
  appointment: 'appointments',
  queue: 'queues',
  solicitacao_exame: 'solicitacoes_exames',
  plan_subscription: 'plan_subscription_orders',
};

const NOTIFIABLE_PAYMENT_STATUS = {
  paid: {
    typeKey: 'financial.payment_approved',
    deduplicationSegment: 'approved',
  },
  payment_failed: {
    typeKey: 'financial.payment_failed',
    deduplicationSegment: 'failed',
  },
  payment_expired: {
    typeKey: 'financial.payment_expired',
    deduplicationSegment: 'expired',
  },
  refunded: {
    typeKey: 'financial.refund_processed',
    deduplicationSegment: 'refunded',
  },
} satisfies Partial<Record<PaymentChargeStatus, {
  typeKey: string;
  deduplicationSegment: string;
}>>;

export type NotifiablePaymentStatus = keyof typeof NOTIFIABLE_PAYMENT_STATUS;

export function isNotifiablePaymentStatus(
  status: PaymentChargeStatus,
): status is NotifiablePaymentStatus {
  return status in NOTIFIABLE_PAYMENT_STATUS;
}

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

export async function notifyPaymentStatusBestEffort(
  client: SupabaseClient,
  {
    paymentChargeId,
    ownerType,
    ownerId,
    status,
    requestId,
    functionName,
  }: {
    paymentChargeId: string;
    ownerType: PaymentOwnerType;
    ownerId: string;
    status: NotifiablePaymentStatus;
    requestId?: string | null;
    functionName: string;
  },
) {
  const notification = NOTIFIABLE_PAYMENT_STATUS[status];
  let recipientUserId: string | null = null;
  let deduplicationKey = `payment_charge:${paymentChargeId}:${notification.deduplicationSegment}:unresolved`;

  try {
    recipientUserId = await resolvePaymentOwnerRecipientUserId(client, ownerType, ownerId);
    deduplicationKey = `payment_charge:${paymentChargeId}:${notification.deduplicationSegment}:${recipientUserId}`;
  } catch (error) {
    logInternalNotificationFailure({
      functionName,
      requestId,
      typeKey: notification.typeKey,
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
      typeKey: notification.typeKey,
      relatedEntityType: 'payment_charge',
      relatedEntityId: paymentChargeId,
      deduplicationKey,
    },
  });
}
