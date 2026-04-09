import { AppError } from './errors.ts';
import type { SupabaseClient } from './supabase.ts';

export type AppUserRecord = {
  id: string;
  authUserId: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  isActive: boolean;
};

type AppUserRow = {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_active: boolean | null;
};

export async function findAppUserByAuthUserId(
  client: SupabaseClient,
  authUserId: string,
): Promise<AppUserRecord | null> {
  const { data, error } = await client
    .from('app_users')
    .select('id, auth_user_id, full_name, email, phone, role, is_active')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'APP_USER_LOOKUP_FAILED',
      message: 'Unable to load application user.',
      details: error.message,
    });
  }

  const row = data as AppUserRow | null;

  if (!row?.id) {
    return null;
  }

  return {
    id: row.id,
    authUserId: row.auth_user_id || authUserId,
    fullName: row.full_name || '',
    email: row.email || '',
    phone: row.phone || '',
    role: row.role || '',
    isActive: Boolean(row.is_active),
  };
}
