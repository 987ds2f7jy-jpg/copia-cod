import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { AppError } from '../_shared/errors.ts';
import { SIGNUP_LEGAL_EVENTS, getLegalDocument } from '../_shared/legal-documents.ts';
import {
  createServiceRoleClient,
  getRequiredEnv,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  AppUserRecord,
  AuthSessionRecord,
  BootstrapAuthenticatedUser,
  BootstrapAuthenticatedUserLookup,
  BootstrapAppUserRepository,
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

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

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

function createPublicAuthClient() {
  return createClient(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_ANON_KEY'),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

async function loadAppUserByAuthUserId(client: SupabaseClient, authUserId: string) {
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

  return (data as AppUserRow | null) || null;
}

async function loadAppUserByEmail(client: SupabaseClient, email: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const { data, error } = await client
    .from('app_users')
    .select('id, auth_user_id, full_name, email, role, is_active, phone, cpf, birth_date, sex, address, city, state, profile_complete')
    .eq('email', normalizedEmail)
    .limit(1);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'APP_USER_EMAIL_LOOKUP_FAILED',
      message: 'Unable to load application user by email.',
      details: error.message,
    });
  }

  return ((data as AppUserRow[] | null) || [])[0] || null;
}

function createBootstrapAppUserRepository(client: SupabaseClient): BootstrapAppUserRepository {
  return {
    async findAppUserByAuthUserId(authUserId) {
      const row = await loadAppUserByAuthUserId(client, authUserId);
      return row?.id ? mapAppUserRow(row) : null;
    },

    async findAppUserByEmail(email) {
      const row = await loadAppUserByEmail(client, email);
      return row?.id ? mapAppUserRow(row) : null;
    },

    async createAuthUser({ email, password, fullName, role }) {
      const normalizedEmail = normalizeEmail(email);
      const { data, error } = await client.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role,
        },
      });

      if (error) {
        const errorMessage = String(error.message || '');
        const status = errorMessage.toLowerCase().includes('already') ? 409 : 500;
        const code = status === 409 ? 'EMAIL_ALREADY_IN_USE' : 'AUTH_USER_CREATE_FAILED';

        throw new AppError({
          status,
          code,
          message: errorMessage || 'Unable to create auth user.',
        });
      }

      if (!data.user?.id) {
        throw new AppError({
          status: 500,
          code: 'AUTH_USER_CREATE_FAILED',
          message: 'Unable to create auth user.',
        });
      }

      return {
        authUserId: data.user.id,
        email: normalizedEmail,
      };
    },

    async deleteAuthUser(authUserId) {
      const { error } = await client.auth.admin.deleteUser(authUserId);

      if (error) {
        throw new AppError({
          status: 500,
          code: 'AUTH_USER_DELETE_FAILED',
          message: 'Unable to rollback auth user.',
          details: error.message,
        });
      }
    },

    async deleteAppUser(appUserId) {
      const { error } = await client
        .from('app_users')
        .delete()
        .eq('id', appUserId);

      if (error) {
        throw new AppError({
          status: 500,
          code: 'APP_USER_DELETE_FAILED',
          message: 'Unable to rollback application user.',
        });
      }
    },

    async createAppUser(payload) {
      const { data, error } = await client
        .from('app_users')
        .insert({
          auth_user_id: payload.authUserId,
          full_name: payload.fullName,
          email: normalizeEmail(payload.email),
          role: payload.role,
          is_active: payload.isActive,
          phone: payload.phone,
          cpf: payload.cpf,
          birth_date: payload.birthDate,
          sex: payload.sex,
          address: payload.address,
          city: payload.city,
          state: payload.state,
          profile_complete: payload.profileComplete,
        })
        .select('id, auth_user_id, full_name, email, role, is_active, phone, cpf, birth_date, sex, address, city, state, profile_complete')
        .single();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'APP_USER_CREATE_FAILED',
          message: 'Unable to create application user.',
          details: error.message,
        });
      }

      return mapAppUserRow(data as AppUserRow);
    },

    async updateAppUser(appUserId, payload) {
      const { data, error } = await client
        .from('app_users')
        .update({
          auth_user_id: payload.authUserId,
          full_name: payload.fullName,
          email: normalizeEmail(payload.email),
          role: payload.role,
          is_active: payload.isActive,
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

    async recordSignupLegalEvents({ userId, role }) {
      const source = role === 'professional' ? 'signup_professional' : 'signup_patient';
      const rows = SIGNUP_LEGAL_EVENTS.map(({ documentKey, eventType }) => {
        const document = getLegalDocument(documentKey);

        if (!document) {
          throw new AppError({
            status: 500,
            code: 'LEGAL_DOCUMENT_CONFIG_INVALID',
            message: 'Legal document configuration is invalid.',
          });
        }

        return {
          user_id: userId,
          document_key: document.key,
          document_version: document.version,
          event_type: eventType,
          source,
          locale: 'pt-BR',
        };
      });
      const { error } = await client
        .from('legal_user_events')
        .upsert(rows, {
          onConflict: 'user_id,document_key,document_version,event_type',
          ignoreDuplicates: true,
        });

      if (error) {
        throw new AppError({
          status: 500,
          code: 'LEGAL_EVENT_RECORD_FAILED',
          message: 'Unable to record required legal events.',
        });
      }

      return rows.map((row) => ({
        documentKey: row.document_key,
        documentVersion: row.document_version,
        eventType: row.event_type,
      }));
    },

    async signInWithPassword({ email, password }) {
      const publicClient = createPublicAuthClient();
      const { data, error } = await publicClient.auth.signInWithPassword({
        email: normalizeEmail(email),
        password,
      });

      if (error || !data.session?.access_token || !data.session.refresh_token) {
        throw new AppError({
          status: 500,
          code: 'AUTH_SESSION_CREATE_FAILED',
          message: 'Unable to create an authenticated session for the new user.',
          details: error?.message,
        });
      }

      const session: AuthSessionRecord = {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at ?? null,
        expiresIn: data.session.expires_in ?? null,
        tokenType: data.session.token_type ?? null,
      };

      return session;
    },
  };
}

async function lookupBootstrapAuthenticatedUser(
  accessToken: string,
): Promise<BootstrapAuthenticatedUser | null> {
  const client = createServiceRoleClient();
  const { data, error } = await client.auth.getUser(accessToken);

  if (error || !data.user?.id || !data.user.email) {
    return null;
  }

  const metadata = (data.user.user_metadata || {}) as Record<string, unknown>;
  const fullName = String(metadata.full_name ?? metadata.name ?? '').trim()
    || data.user.email.split('@')[0]
    || 'Usuario';
  const roleRaw = String(metadata.role ?? '').trim().toLowerCase();
  const role = roleRaw === 'admin'
    ? 'admin'
    : roleRaw === 'professional'
      ? 'professional'
      : 'patient';

  return {
    authUserId: data.user.id,
    email: normalizeEmail(data.user.email),
    fullName,
    role,
  };
}

export function createBootstrapAppUserRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: lookupBootstrapAuthenticatedUser as BootstrapAuthenticatedUserLookup,
    repository: createBootstrapAppUserRepository(client),
  };
}
