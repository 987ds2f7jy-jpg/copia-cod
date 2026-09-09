import { requireActiveBackofficeAdmin } from '../_shared/backofficeAuth.ts';
import type { SupabaseClient } from '../_shared/supabase.ts';
import type { createBackofficeAnalyticsRepository } from './repository.ts';

export async function getBackofficeAnalyticsSummary({ req, client, repository }: {
  req: Request;
  client: SupabaseClient;
  repository: ReturnType<typeof createBackofficeAnalyticsRepository>;
}) {
  await requireActiveBackofficeAdmin(req, client);
  return repository.getSummary();
}
