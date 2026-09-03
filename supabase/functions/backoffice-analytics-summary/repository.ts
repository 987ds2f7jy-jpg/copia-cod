import { AppError } from '../_shared/errors.ts';
import { createServiceRoleClient, type SupabaseClient } from '../_shared/supabase.ts';

async function countRows(client: SupabaseClient, table: string, completedOnly = false) {
  let query = client.from(table).select('*', { count: 'exact', head: true });
  if (completedOnly) query = query.eq('status', 'finalizada');
  const { count, error } = await query;
  if (error) throw new AppError({ status: 500, code: 'BACKOFFICE_ANALYTICS_LOOKUP_FAILED', message: 'Unable to load backoffice analytics.' });
  return count || 0;
}

export function createBackofficeAnalyticsRepository(client: SupabaseClient) {
  return {
    async getSummary() {
      const [totalProfessionals, totalUsers, totalCompletedConsultations] = await Promise.all([
        countRows(client, 'professional_profiles'),
        countRows(client, 'app_users'),
        countRows(client, 'consultas', true),
      ]);
      return { totalProfessionals, totalUsers, totalCompletedConsultations };
    },
  };
}

export function createBackofficeAnalyticsRuntime() {
  const client = createServiceRoleClient();
  return { client, repository: createBackofficeAnalyticsRepository(client) };
}
