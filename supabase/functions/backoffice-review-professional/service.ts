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
  const professional = await repository.review({ ...input, adminUserId: admin.id });
  return { professional };
}
