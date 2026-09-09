import { AppError } from '../_shared/errors.ts';
import { createServiceRoleClient, type SupabaseClient } from '../_shared/supabase.ts';

export function createPendingProfessionalsRepository(client: SupabaseClient) {
  return {
    async listPending(limit: number) {
      const { data, error } = await client
        .from('professional_profiles')
        .select('id, full_name, profession, specialty, register_number, register_state, phone, cpf, created_date, status')
        .eq('status', 'pending')
        .order('created_date', { ascending: true })
        .limit(limit);
      if (error) throw new AppError({ status: 500, code: 'PENDING_PROFESSIONALS_LOOKUP_FAILED', message: 'Unable to load pending professionals.' });
      return data || [];
    },
  };
}

export function createPendingProfessionalsRuntime() {
  const client = createServiceRoleClient();
  return { client, repository: createPendingProfessionalsRepository(client) };
}
