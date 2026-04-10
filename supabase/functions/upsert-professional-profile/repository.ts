import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { requireAppUserByAuthUserId, requireRole } from '../_shared/professional.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  AvailabilitySlotRecord,
  ProfessionalProfileRecord,
  ProfessionalPublicProfileRecord,
  UpsertProfessionalProfileRepository,
} from './types.ts';

async function findProfessionalProfileByAppUserId(
  client: SupabaseClient,
  appUserId: string,
): Promise<ProfessionalProfileRecord | null> {
  const { data, error } = await client
    .from('professional_profiles')
    .select(`
      id,
      user_id,
      status,
      is_on_duty,
      bio,
      photo_url,
      price_standard,
      price_priority,
      available_days,
      available_hours,
      perfil_ativo,
      prioritario_ativo
    `)
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

  return (data as ProfessionalProfileRecord | null) || null;
}

async function findProfessionalPublicProfileByProfessionalId(
  client: SupabaseClient,
  professionalId: string,
): Promise<ProfessionalPublicProfileRecord | null> {
  const { data, error } = await client
    .from('professional_public_profiles')
    .select(`
      id,
      professional_profile_id,
      status,
      is_on_duty,
      bio,
      photo_url,
      instagram_url,
      tags,
      patient_types,
      modality,
      office_city,
      office_state,
      office_address,
      gallery_urls,
      price_standard,
      price_priority,
      available_days,
      available_hours,
      perfil_ativo,
      prioritario_ativo
    `)
    .eq('professional_profile_id', professionalId)
    .order('created_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PUBLIC_PROFILE_LOOKUP_FAILED',
      message: 'Unable to load public profile.',
      details: error.message,
    });
  }

  return (data as ProfessionalPublicProfileRecord | null) || null;
}

async function updateProfessionalProfile(
  client: SupabaseClient,
  professionalId: string,
  updates: Record<string, unknown>,
) {
  const { data, error } = await client
    .from('professional_profiles')
    .update(updates)
    .eq('id', professionalId)
    .select(`
      id,
      user_id,
      status,
      is_on_duty,
      bio,
      photo_url,
      price_standard,
      price_priority,
      available_days,
      available_hours,
      perfil_ativo,
      prioritario_ativo
    `)
    .single();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PROFESSIONAL_PROFILE_UPDATE_FAILED',
      message: 'Unable to update professional profile.',
      details: error.message,
    });
  }

  return data as ProfessionalProfileRecord;
}

async function updateProfessionalPublicProfile(
  client: SupabaseClient,
  publicProfileId: string,
  updates: Record<string, unknown>,
) {
  const { data, error } = await client
    .from('professional_public_profiles')
    .update(updates)
    .eq('id', publicProfileId)
    .select(`
      id,
      professional_profile_id,
      status,
      is_on_duty,
      bio,
      photo_url,
      instagram_url,
      tags,
      patient_types,
      modality,
      office_city,
      office_state,
      office_address,
      gallery_urls,
      price_standard,
      price_priority,
      available_days,
      available_hours,
      perfil_ativo,
      prioritario_ativo
    `)
    .single();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PUBLIC_PROFILE_UPDATE_FAILED',
      message: 'Unable to update public profile.',
      details: error.message,
    });
  }

  return data as ProfessionalPublicProfileRecord;
}

async function listAvailabilitySlotsByProfessionalId(client: SupabaseClient, professionalId: string) {
  const { data, error } = await client
    .from('availability_slots')
    .select('id, professional_id, weekday, time_slot')
    .eq('professional_id', professionalId)
    .order('weekday', { ascending: true })
    .order('time_slot', { ascending: true });

  if (error) {
    throw new AppError({
      status: 500,
      code: 'AVAILABILITY_LOOKUP_FAILED',
      message: 'Unable to load availability slots.',
      details: error.message,
    });
  }

  return (data as AvailabilitySlotRecord[] | null) || [];
}

function createUpsertProfessionalProfileRepository(client: SupabaseClient): UpsertProfessionalProfileRepository {
  return {
    findProfessionalProfileByAppUserId: (appUserId) => findProfessionalProfileByAppUserId(client, appUserId),
    findProfessionalPublicProfileByProfessionalId: (professionalId) =>
      findProfessionalPublicProfileByProfessionalId(client, professionalId),
    updateProfessionalProfile: ({ professionalId, updates }) => updateProfessionalProfile(client, professionalId, updates),
    updateProfessionalPublicProfile: ({ publicProfileId, updates }) =>
      updateProfessionalPublicProfile(client, publicProfileId, updates),
    listAvailabilitySlotsByProfessionalId: (professionalId) => listAvailabilitySlotsByProfessionalId(client, professionalId),
  };
}

export function createUpsertProfessionalProfileRuntime() {
  const client = createServiceRoleClient();

  const authUserLookup = createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup;

  return {
    authUserLookup,
    async resolveAppUser(authUserId: string) {
      const appUser = await requireAppUserByAuthUserId(client, authUserId);
      requireRole(appUser, ['professional']);
      return appUser;
    },
    repository: createUpsertProfessionalProfileRepository(client),
  };
}

