import { requireActiveBackofficeAdmin } from '../_shared/backofficeAuth.ts';
import {
  logInternalNotificationFailure,
  notifyInternalBestEffort,
  type InternalNotificationNotifier,
} from '../_shared/notifications/notify-best-effort.ts';
import type { SupabaseClient } from '../_shared/supabase.ts';
import type { createBackofficeReviewProfessionalRepository } from './repository.ts';

export async function reviewBackofficeProfessional({
  req,
  client,
  repository,
  notificationService,
  input,
  requestId,
}: {
  req: Request;
  client: SupabaseClient;
  repository: ReturnType<typeof createBackofficeReviewProfessionalRepository>;
  notificationService?: InternalNotificationNotifier;
  input: { professionalProfileId: string; action: 'approve' | 'reject'; reason: string | null };
  requestId: string;
}) {
  const admin = await requireActiveBackofficeAdmin(req, client);
  console.info('[backoffice-review-professional] request:start', {
    requestId,
    stage: 'authorized',
    adminUserId: admin.id,
    professionalProfileId: input.professionalProfileId,
    action: input.action,
  });
  const professional = await repository.review({ ...input, adminUserId: admin.id, requestId });
  console.info('[backoffice-review-professional] request:succeeded', {
    requestId,
    stage: 'completed',
    adminUserId: admin.id,
    professionalProfileId: professional.professional_profile_id,
    action: input.action,
    status: professional.status,
  });

  let recipientUserId: string | null = null;

  if (notificationService) {
    try {
      recipientUserId = await repository.findProfessionalAppUserId(
        professional.professional_profile_id,
      );

      if (!recipientUserId) {
        logInternalNotificationFailure({
          functionName: 'backoffice-review-professional',
          requestId,
          typeKey: input.action === 'approve'
            ? 'professional.registration_approved'
            : 'professional.registration_rejected',
          recipientUserId: null,
          relatedEntityType: 'professional_profile',
          relatedEntityId: professional.professional_profile_id,
          deduplicationKey: `professional_profile:${professional.professional_profile_id}:${input.action === 'approve' ? 'approved' : 'rejected'}:unresolved`,
        }, new Error('Professional profile does not have an app user id.'));
      }
    } catch (error) {
      logInternalNotificationFailure({
        functionName: 'backoffice-review-professional',
        requestId,
        typeKey: input.action === 'approve'
          ? 'professional.registration_approved'
          : 'professional.registration_rejected',
        recipientUserId: null,
        relatedEntityType: 'professional_profile',
        relatedEntityId: professional.professional_profile_id,
        deduplicationKey: `professional_profile:${professional.professional_profile_id}:${input.action === 'approve' ? 'approved' : 'rejected'}:unresolved`,
      }, error);
    }

    if (recipientUserId) {
      const action = input.action === 'approve' ? 'approved' : 'rejected';
      await notifyInternalBestEffort({
        notificationService,
        functionName: 'backoffice-review-professional',
        requestId,
        input: {
          recipientUserId,
          typeKey: input.action === 'approve'
            ? 'professional.registration_approved'
            : 'professional.registration_rejected',
          relatedEntityType: 'professional_profile',
          relatedEntityId: professional.professional_profile_id,
          deduplicationKey: `professional_profile:${professional.professional_profile_id}:${action}:${recipientUserId}`,
        },
      });
    }
  }

  return { professional };
}
