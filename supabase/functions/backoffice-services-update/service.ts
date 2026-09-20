import { requireActiveBackofficeAdmin } from '../_shared/backofficeAuth.ts';
import type { SupabaseClient } from '../_shared/supabase.ts';
import type { createBackofficeServicesUpdateRepository } from './repository.ts';
import type { BackofficeServicesUpdateInput } from './validation.ts';

export async function updateBackofficeService({ req, client, repository, input, requestId }: {
  req: Request;
  client: SupabaseClient;
  repository: ReturnType<typeof createBackofficeServicesUpdateRepository>;
  input: BackofficeServicesUpdateInput;
  requestId: string;
}) {
  const admin = await requireActiveBackofficeAdmin(req, client);
  const service = await repository.update({ ...input, adminUserId: admin.id, requestId });
  return { service };
}
