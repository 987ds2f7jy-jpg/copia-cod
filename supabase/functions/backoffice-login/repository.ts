import { AppError } from '../_shared/errors.ts';
import { createServiceRoleClient, type SupabaseClient } from '../_shared/supabase.ts';

export type BackofficeAdminLoginRecord = {
  id: string;
  email: string;
  password_hash: string;
  is_active: boolean;
};

export function createBackofficeLoginRepository(client: SupabaseClient) {
  return {
    async findByEmail(email: string): Promise<BackofficeAdminLoginRecord | null> {
      const { data, error } = await client
        .from('admin_users')
        .select('id, email, password_hash, is_active')
        .eq('email', email)
        .maybeSingle();
      if (error) {
        throw new AppError({ status: 500, code: 'ADMIN_LOGIN_LOOKUP_FAILED', message: 'Unable to complete administrative login.' });
      }
      return data as BackofficeAdminLoginRecord | null;
    },
  };
}

export function createBackofficeLoginRuntime() {
  const client = createServiceRoleClient();
  return { repository: createBackofficeLoginRepository(client) };
}
