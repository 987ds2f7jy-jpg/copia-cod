import { requireActiveBackofficeAdmin } from '../_shared/backofficeAuth.ts';
import type { SupabaseClient } from '../_shared/supabase.ts';
import type { createPendingProfessionalsRepository } from './repository.ts';

export async function listPendingProfessionals({ req, client, repository, limit }: {
  req: Request;
  client: SupabaseClient;
  repository: ReturnType<typeof createPendingProfessionalsRepository>;
  limit: number;
}) {
  await requireActiveBackofficeAdmin(req, client);
  const professionals = await repository.listPending(limit);
  return { professionals };
}
