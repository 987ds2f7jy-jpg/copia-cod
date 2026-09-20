import { requireActiveBackofficeAdmin } from '../_shared/backofficeAuth.ts';
import type { SupabaseClient } from '../_shared/supabase.ts';
import type { createBackofficeServicesListRepository } from './repository.ts';

export async function listBackofficeServices({ req, client, repository }: {
  req: Request;
  client: SupabaseClient;
  repository: ReturnType<typeof createBackofficeServicesListRepository>;
}) {
  await requireActiveBackofficeAdmin(req, client);
  return { services: await repository.list() };
}
