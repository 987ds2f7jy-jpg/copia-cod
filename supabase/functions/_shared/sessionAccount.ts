import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { AppError } from './errors.ts';
import { requireAuthenticatedUser } from './auth.ts';
import {
  createSupabaseAuthUserLookup,
  createServiceRoleClient,
  getRequiredEnv,
  type SupabaseClient,
} from './supabase.ts';

export type SessionAccountRecord = {
  id: string;
  authUserId: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  phone: string;
  cpf: string;
  birthDate: string;
  sex: string;
  address: string;
  city: string;
  state: string;
  profileComplete: boolean;
};

export type AuthSessionRecord = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  expiresIn: number | null;
  tokenType: string | null;
};

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

function mapSession(session: {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number | null;
  expires_in?: number | null;
  token_type?: string | null;
} | null | undefined): AuthSessionRecord {
  if (!session?.access_token || !session.refresh_token) {
    throw new AppError({
      status: 401,
      code: 'AUTH_SESSION_INVALID',
      message: 'Authenticated session was not returned.',
    });
  }

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? null,
    expiresIn: session.expires_in ?? null,
    tokenType: session.token_type ?? null,
  };
}

function mapAppUserRow(row: AppUserRow): SessionAccountRecord {
  return {
    id: row.id,
    authUserId: row.auth_user_id || '',
    fullName: row.full_name || '',
    email: normalizeEmail(row.email || ''),
    role: row.role || 'patient',
    isActive: row.is_active !== false,
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

export function createPublicAuthClient() {
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

export async function signInWithPassword(params: {
  email: string;
  password: string;
}) {
  const client = createPublicAuthClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: normalizeEmail(params.email),
    password: params.password,
  });

  if (error || !data.user?.id) {
    throw new AppError({
      status: 401,
      code: 'AUTH_CREDENTIALS_INVALID',
      message: 'Email or password is invalid.',
      details: error?.message,
    });
  }

  return {
    authUserId: data.user.id,
    email: normalizeEmail(data.user.email || params.email),
    session: mapSession(data.session),
  };
}

export async function refreshAuthSession(refreshToken: string) {
  const client = createPublicAuthClient();
  const { data, error } = await client.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.user?.id) {
    throw new AppError({
      status: 401,
      code: 'AUTH_REFRESH_INVALID',
      message: 'Session could not be refreshed.',
      details: error?.message,
    });
  }

  return {
    authUserId: data.user.id,
    email: normalizeEmail(data.user.email || ''),
    session: mapSession(data.session),
  };
}

export async function loadSessionAccountByAuthUserId(
  client: SupabaseClient,
  authUserId: string,
): Promise<SessionAccountRecord | null> {
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

  return data?.id ? mapAppUserRow(data as AppUserRow) : null;
}

export function assertActiveSessionAccount(appUser: SessionAccountRecord | null) {
  if (!appUser?.id) {
    throw new AppError({
      status: 403,
      code: 'APP_USER_NOT_FOUND',
      message: 'Authenticated user is not linked to app_users.',
    });
  }

  if (appUser.isActive === false) {
    throw new AppError({
      status: 403,
      code: 'ACCOUNT_INACTIVE',
      message: 'Authenticated account is inactive.',
    });
  }

  return appUser;
}

export function createSessionAccountServiceClient() {
  return createServiceRoleClient();
}

export async function requireActiveSessionAccount(
  req: Request,
  client: SupabaseClient = createSessionAccountServiceClient(),
) {
  const authenticatedUser = await requireAuthenticatedUser(
    req,
    createSupabaseAuthUserLookup(client),
  );

  return assertActiveSessionAccount(
    await loadSessionAccountByAuthUserId(client, authenticatedUser.authUserId),
  );
}
