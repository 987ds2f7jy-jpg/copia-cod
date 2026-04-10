import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { requireAppUserByAuthUserId, requireRole } from '../_shared/professional.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type { OfficeLocationRecord, UpsertOfficeLocationRepository } from './types.ts';

async function findProfessionalProfileIdByAppUserId(client: SupabaseClient, appUserId: string) {
  const { data, error } = await client
    .from('professional_profiles')
    .select('id')
    .eq('user_id', appUserId)
    .order('created_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PROFESSIONAL_PROFILE_LOOKUP_FAILED',
      message: 'Unable to load professional profile.',
      details: error.message,
    });
  }

  return (data as { id?: string } | null)?.id || null;
}

async function findPublicProfileById(client: SupabaseClient, publicProfileId: string) {
  const { data, error } = await client
    .from('professional_public_profiles')
    .select('id, professional_profile_id, user_id')
    .eq('id', publicProfileId)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PUBLIC_PROFILE_LOOKUP_FAILED',
      message: 'Unable to load public profile.',
      details: error.message,
    });
  }

  return (data as { id: string; professional_profile_id: string; user_id: string } | null) || null;
}

async function getPrimaryOfficeLocation(client: SupabaseClient, publicProfileId: string) {
  const { data, error } = await client
    .from('professional_office_locations')
    .select('*')
    .eq('professional_public_profile_id', publicProfileId)
    .eq('is_primary', true)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'OFFICE_LOCATION_LOOKUP_FAILED',
      message: 'Unable to load office location.',
      details: error.message,
    });
  }

  return (data as OfficeLocationRecord | null) || null;
}

async function upsertPrimaryOfficeLocation(
  client: SupabaseClient,
  publicProfileId: string,
  record: Omit<OfficeLocationRecord, 'id'>,
) {
  const existing = await getPrimaryOfficeLocation(client, publicProfileId);

  if (existing?.id) {
    const { data, error } = await client
      .from('professional_office_locations')
      .update(record)
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) {
      throw new AppError({
        status: 500,
        code: 'OFFICE_LOCATION_UPDATE_FAILED',
        message: 'Unable to update office location.',
        details: error.message,
      });
    }

    return data as OfficeLocationRecord;
  }

  const { data, error } = await client
    .from('professional_office_locations')
    .insert(record)
    .select('*')
    .single();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'OFFICE_LOCATION_CREATE_FAILED',
      message: 'Unable to create office location.',
      details: error.message,
    });
  }

  return data as OfficeLocationRecord;
}

async function deletePrimaryOfficeLocation(client: SupabaseClient, publicProfileId: string) {
  const { error } = await client
    .from('professional_office_locations')
    .delete()
    .eq('professional_public_profile_id', publicProfileId)
    .eq('is_primary', true);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'OFFICE_LOCATION_DELETE_FAILED',
      message: 'Unable to delete office location.',
      details: error.message,
    });
  }
}

function createUpsertOfficeLocationRepository(client: SupabaseClient): UpsertOfficeLocationRepository {
  return {
    findProfessionalProfileIdByAppUserId: (appUserId) => findProfessionalProfileIdByAppUserId(client, appUserId),
    findPublicProfileById: (publicProfileId) => findPublicProfileById(client, publicProfileId),
    getPrimaryOfficeLocation: (publicProfileId) => getPrimaryOfficeLocation(client, publicProfileId),
    upsertPrimaryOfficeLocation: ({ publicProfileId, record }) => upsertPrimaryOfficeLocation(client, publicProfileId, record),
    deletePrimaryOfficeLocation: (publicProfileId) => deletePrimaryOfficeLocation(client, publicProfileId),
  };
}

export function createUpsertOfficeLocationRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    async resolveAppUser(authUserId: string) {
      const appUser = await requireAppUserByAuthUserId(client, authUserId);
      requireRole(appUser, ['professional', 'admin']);
      return appUser;
    },
    repository: createUpsertOfficeLocationRepository(client),
  };
}

