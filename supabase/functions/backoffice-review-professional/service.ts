import { requireActiveBackofficeAdmin } from '../_shared/backofficeAuth.ts';
import type { SupabaseClient } from '../_shared/supabase.ts';
import type { createBackofficeReviewProfessionalRepository } from './repository.ts';

export async function reviewBackofficeProfessional({
  req,
  client,
  repository,
  input,
}: {
  req: Request;
  client: SupabaseClient;
  repository: ReturnType<typeof createBackofficeReviewProfessionalRepository>;
  input: { professionalProfileId: string; action: 'approve' | 'reject'; reason: string | null };
}) {
  const admin = await requireActiveBackofficeAdmin(req, client);
  console.info('[backoffice-review-professional] request:start', {
    adminUserId: admin.id,
    professionalProfileId: input.professionalProfileId,
    action: input.action,
  });
  const professional = await repository.review({ ...input, adminUserId: admin.id });
  console.info('[backoffice-review-professional] request:succeeded', {
    adminUserId: admin.id,
    professionalProfileId: professional.professional_profile_id,
    action: input.action,
    status: professional.status,
  });
  return { professional };
}
