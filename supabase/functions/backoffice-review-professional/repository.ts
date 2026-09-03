import { AppError } from '../_shared/errors.ts';
import { createServiceRoleClient, type SupabaseClient } from '../_shared/supabase.ts';

export function createBackofficeReviewProfessionalRepository(client: SupabaseClient) {
  return {
    async review(input: {
      professionalProfileId: string;
      adminUserId: string;
      action: 'approve' | 'reject';
      reason: string | null;
      requestId: string;
    }) {
      const rpcName = 'review_backoffice_professional';
      // Do not log the free-text reason: it may contain personal or clinical data.
      const rpcParams = {
        p_professional_profile_id: input.professionalProfileId,
        p_admin_user_id: input.adminUserId,
        p_action: input.action,
        p_reason_provided: input.reason !== null,
      };
      const { data, error } = await client.rpc(rpcName, {
        p_professional_profile_id: input.professionalProfileId,
        p_admin_user_id: input.adminUserId,
        p_action: input.action,
        p_reason: input.reason,
      });
      if (error) {
        console.error('[backoffice-review-professional] rpc:failed', {
          requestId: input.requestId,
          stage: 'rpc.review_backoffice_professional',
          professionalProfileId: input.professionalProfileId,
          adminUserId: input.adminUserId,
          action: input.action,
          rpcName,
          rpcParams,
          rawSupabaseRpcError: error,
          errorMessage: error.message || null,
          errorCode: error.code || null,
          errorDetails: error.details || null,
          errorHint: error.hint || null,
          errorStack: error instanceof Error ? error.stack || null : null,
        });

        const code = error.message?.includes('PROFESSIONAL_PROFILE_NOT_FOUND')
          ? 'PROFESSIONAL_PROFILE_NOT_FOUND'
          : error.message?.includes('PROFESSIONAL_PROFILE_NOT_PENDING')
            ? 'PROFESSIONAL_PROFILE_NOT_PENDING'
            : 'PROFESSIONAL_PROFILE_REVIEW_FAILED';
        throw new AppError({
          status: code === 'PROFESSIONAL_PROFILE_NOT_FOUND' ? 404 : code === 'PROFESSIONAL_PROFILE_NOT_PENDING' ? 409 : 500,
          code,
          message: code === 'PROFESSIONAL_PROFILE_NOT_FOUND'
            ? 'Professional profile was not found.'
            : code === 'PROFESSIONAL_PROFILE_NOT_PENDING'
              ? 'Only pending professional profiles can be reviewed.'
              : 'Unable to review professional profile.',
        });
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        console.error('[backoffice-review-professional] rpc:empty_result', {
          requestId: input.requestId,
          stage: 'rpc.review_backoffice_professional',
          professionalProfileId: input.professionalProfileId,
          adminUserId: input.adminUserId,
          action: input.action,
          rpcName,
          rpcParams,
        });
        throw new AppError({
          status: 500,
          code: 'PROFESSIONAL_PROFILE_REVIEW_FAILED',
          message: 'Unable to review professional profile.',
        });
      }
      return row as { professional_profile_id: string; status: string; is_verified: boolean };
    },
  };
}

export function createBackofficeReviewProfessionalRuntime() {
  const client = createServiceRoleClient();
  return { client, repository: createBackofficeReviewProfessionalRepository(client) };
}
