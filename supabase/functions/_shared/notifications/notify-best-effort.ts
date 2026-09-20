import type { InternalNotificationService } from './InternalNotificationService.ts';
import type { NotifyInput } from './NotificationTypes.ts';

export type InternalNotificationNotifier = Pick<InternalNotificationService, 'notify'>;

type NotificationFailureContext = {
  functionName: string;
  requestId?: string | null;
  typeKey: string;
  recipientUserId?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  deduplicationKey?: string | null;
};

export function logInternalNotificationFailure(
  context: NotificationFailureContext,
  error: unknown,
) {
  console.error('[internal-notification] notify:failed', {
    functionName: context.functionName,
    requestId: context.requestId || null,
    typeKey: context.typeKey,
    recipientUserId: context.recipientUserId || null,
    relatedEntityType: context.relatedEntityType || null,
    relatedEntityId: context.relatedEntityId || null,
    deduplicationKey: context.deduplicationKey || null,
    error,
  });
}

export async function notifyInternalBestEffort({
  notificationService,
  input,
  functionName,
  requestId,
}: {
  notificationService: InternalNotificationNotifier;
  input: NotifyInput;
  functionName: string;
  requestId?: string | null;
}) {
  try {
    await notificationService.notify(input);
    return true;
  } catch (error) {
    logInternalNotificationFailure({
      functionName,
      requestId,
      typeKey: input.typeKey,
      recipientUserId: input.recipientUserId,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      deduplicationKey: input.deduplicationKey,
    }, error);
    return false;
  }
}
