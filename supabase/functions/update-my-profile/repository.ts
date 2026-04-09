import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  AppUserRecord,
  UpdateMyProfileRepository,
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

function createUpdateMyProfileRepository(client: SupabaseClient): UpdateMyProfileRepository {
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

    async updateAppUser(appUserId, payload) {
      const { data, error } = await client
        .from('app_users')
        .update({
          full_name: payload.fullName,
          phone: payload.phone,
          cpf: payload.cpf,
          birth_date: payload.birthDate,
          sex: payload.sex,
          address: payload.address,
          city: payload.city,
          state: payload.state,
          profile_complete: payload.profileComplete,
        })
        .eq('id', appUserId)
        .select('id, auth_user_id, full_name, email, role, is_active, phone, cpf, birth_date, sex, address, city, state, profile_complete')
        .single();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'APP_USER_UPDATE_FAILED',
          message: 'Unable to update application user.',
          details: error.message,
        });
      }

      return mapAppUserRow(data as AppUserRow);
    },

    async updateAuthMetadata({ authUserId, fullName, role }) {
      const { error } = await client.auth.admin.updateUserById(authUserId, {
        user_metadata: {
          full_name: fullName,
          role,
        },
      });

      if (error) {
        throw new AppError({
          status: 500,
          code: 'AUTH_METADATA_UPDATE_FAILED',
          message: 'Unable to update auth metadata.',
          details: error.message,
        });
      }
    },
  };
}

export function createUpdateMyProfileRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    repository: createUpdateMyProfileRepository(client),
  };
}
