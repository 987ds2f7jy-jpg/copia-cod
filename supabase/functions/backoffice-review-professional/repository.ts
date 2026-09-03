import { AppError } from '../_shared/errors.ts';
import { createServiceRoleClient, type SupabaseClient } from '../_shared/supabase.ts';

export function createBackofficeReviewProfessionalRepository(client: SupabaseClient) {
  return {
    async review(input: { professionalProfileId: string; adminUserId: string; action: 'approve' | 'reject'; reason: string | null }) {
      const { data, error } = await client.rpc('review_backoffice_professional', {
        p_professional_profile_id: input.professionalProfileId,
        p_admin_user_id: input.adminUserId,
        p_action: input.action,
        p_reason: input.reason,
      });
      if (error) {
        console.error('[backoffice-review-professional] rpc:failed', {
          professionalProfileId: input.professionalProfileId,
          adminUserId: input.adminUserId,
          action: input.action,
          databaseCode: error.code || null,
          databaseMessage: error.message || null,
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
              : 'Unable to review professional profile. Check the Edge Function logs using the request ID.',
          details: {
            databaseCode: error.code || null,
            databaseMessage: error.message || null,
          },
        });
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new AppError({ status: 500, code: 'PROFESSIONAL_PROFILE_REVIEW_EMPTY', message: 'Review did not return a professional profile.' });
      return row as { professional_profile_id: string; status: string; is_verified: boolean };
    },
  };
}

export function createBackofficeReviewProfessionalRuntime() {
  const client = createServiceRoleClient();
  return { client, repository: createBackofficeReviewProfessionalRepository(client) };
}
