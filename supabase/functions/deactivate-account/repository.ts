import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  AppUserRecord,
  DeactivateAccountRepository,
} from './types.ts';

type AppUserRow = {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
  phone: string | null;
  cpf: string | null;
  birth_date: string | null;
  sex: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  profile_complete: boolean | null;
};

function mapAppUserRow(row: AppUserRow): AppUserRecord {
  return {
    id: row.id,
    authUserId: row.auth_user_id || '',
    fullName: row.full_name || '',
    email: row.email || '',
    role: row.role || 'patient',
    isActive: Boolean(row.is_active),
    phone: row.phone || '',
    cpf: row.cpf || '',
    birthDate: row.birth_date || '',
    sex: row.sex || '',
    address: row.address || '',
    city: row.city || '',
    state: row.state || '',
    profileComplete: Boolean(row.profile_complete),
  };
}

function createDeactivateAccountRepository(client: SupabaseClient): DeactivateAccountRepository {
  return {
    async findAppUserByAuthUserId(authUserId) {
      const { data, error } = await client
        .from('app_users')
        .select('id, auth_user_id, full_name, email, role, is_active, phone, cpf, birth_date, sex, address, city, state, profile_complete')
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
      return row?.id ? mapAppUserRow(row) : null;
    },

    async deactivateAppUser(appUserId) {
      const { data, error } = await client
        .from('app_users')
        .update({
          is_active: false,
        })
        .eq('id', appUserId)
        .select('id, auth_user_id, full_name, email, role, is_active, phone, cpf, birth_date, sex, address, city, state, profile_complete')
        .single();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'APP_USER_DEACTIVATE_FAILED',
          message: 'Unable to deactivate application user.',
          details: error.message,
        });
      }

      return mapAppUserRow(data as AppUserRow);
    },

    async revokeAccessToken(accessToken) {
      const { error } = await client.auth.admin.signOut(accessToken, 'global');

      if (error) {
        throw new AppError({
          status: 500,
          code: 'AUTH_SESSION_INVALIDATION_FAILED',
          message: 'Unable to invalidate user sessions.',
          details: error.message,
        });
      }
    },
  };
}

export function createDeactivateAccountRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    repository: createDeactivateAccountRepository(client),
  };
}
