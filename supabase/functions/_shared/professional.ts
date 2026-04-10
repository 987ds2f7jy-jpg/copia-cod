import { AppError } from './errors.ts';
import type { SupabaseClient } from './supabase.ts';

export type AppRole = 'patient' | 'professional' | 'admin';

export type AppUser = {
  id: string;
  authUserId: string;
  role: AppRole;
  isActive: boolean;
  fullName: string;
  email: string;
};

type AppUserRow = {
  id: string;
  auth_user_id: string | null;
  role: string | null;
  is_active: boolean | null;
  full_name: string | null;
  email: string | null;
};

export async function requireAppUserByAuthUserId(client: SupabaseClient, authUserId: string): Promise<AppUser> {
  const { data, error } = await client
    .from('app_users')
    .select('id, auth_user_id, role, is_active, full_name, email')
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
    throw new AppError({
      status: 403,
      code: 'APP_USER_NOT_FOUND',
      message: 'Authenticated user is not linked to app_users.',
    });
  }

  const role = String(row.role || '').trim() as AppRole;
  const isActive = Boolean(row.is_active);

  if (!isActive) {
    throw new AppError({
      status: 403,
      code: 'ACCOUNT_INACTIVE',
      message: 'Authenticated account is inactive.',
    });
  }

  if (role !== 'patient' && role !== 'professional' && role !== 'admin') {
    throw new AppError({
      status: 403,
      code: 'INVALID_APP_ROLE',
      message: 'Authenticated user has an invalid role.',
      details: { role },
    });
  }

  return {
    id: row.id,
    authUserId: row.auth_user_id || authUserId,
    role,
    isActive,
    fullName: row.full_name || '',
    email: row.email || '',
  };
}

export function requireRole(user: AppUser, allowed: AppRole[]) {
  if (!allowed.includes(user.role)) {
    throw new AppError({
      status: 403,
      code: 'ROLE_FORBIDDEN',
      message: 'You are not allowed to access this resource.',
      details: { role: user.role, allowed },
    });
  }
}

