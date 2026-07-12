import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { requireAppUserByAuthUserId, requireRole } from '../_shared/professional.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  AdminPrivateProfile,
  AdminPublicProfile,
  GetAdminApprovalQueueRepository,
} from './types.ts';

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

async function createSignedUploadUrl(client: SupabaseClient, value: unknown) {
  const path = normalizeString(value);

  if (!path || /^https?:\/\//i.test(path)) {
    return path;
  }

  const { data, error } = await client.storage
    .from('uploads')
    .createSignedUrl(path, 5 * 60);

  if (error || !data?.signedUrl) {
    return path;
  }

  return data.signedUrl;
}

async function decoratePublicProfile(client: SupabaseClient, profile: AdminPublicProfile) {
  return {
    ...profile,
    photo_path: profile.photo_url,
    photo_url: await createSignedUploadUrl(client, profile.photo_url),
  };
}

async function decoratePrivateProfile(client: SupabaseClient, profile: AdminPrivateProfile) {
  return {
    ...profile,
    diploma_path: profile.diploma_url,
    diploma_url: await createSignedUploadUrl(client, profile.diploma_url),
    photo_path: profile.photo_url,
    photo_url: await createSignedUploadUrl(client, profile.photo_url),
  };
}

async function listPublicProfiles(client: SupabaseClient, status: string | null, limit: number) {
  let query = client
    .from('professional_public_profiles')
    .select('*')
    .order('created_date', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError({
      status: 500,
      code: 'ADMIN_PUBLIC_QUEUE_LOAD_FAILED',
      message: 'Unable to load public profiles for approval.',
      details: error.message,
    });
  }

  return Promise.all(((data as AdminPublicProfile[] | null) || []).map((profile) =>
    decoratePublicProfile(client, profile)
  ));
}

async function listPrivateProfiles(client: SupabaseClient, limit: number) {
  const { data, error } = await client
    .from('professional_profiles')
    .select('*')
    .order('created_date', { ascending: false })
    .limit(limit);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'ADMIN_PRIVATE_QUEUE_LOAD_FAILED',
      message: 'Unable to load private profiles.',
      details: error.message,
    });
  }

  return Promise.all(((data as AdminPrivateProfile[] | null) || []).map((profile) =>
    decoratePrivateProfile(client, profile)
  ));
}

function createGetAdminApprovalQueueRepository(client: SupabaseClient): GetAdminApprovalQueueRepository {
  return {
    listPublicProfiles: ({ status, limit }) => listPublicProfiles(client, status, limit),
    listPrivateProfiles: ({ limit }) => listPrivateProfiles(client, limit),
  };
}

export function createGetAdminApprovalQueueRuntime() {
  const client = createServiceRoleClient();
  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    async resolveAdmin(authUserId: string) {
      const appUser = await requireAppUserByAuthUserId(client, authUserId);
      requireRole(appUser, ['admin']);
      return appUser;
    },
    repository: createGetAdminApprovalQueueRepository(client),
  };
}

