import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { requireAppUserByAuthUserId, requireRole } from '../_shared/professional.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type { SetProfessionalDutyRepository } from './types.ts';

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

async function findPublicProfileIdByProfessionalId(client: SupabaseClient, professionalId: string) {
  const { data, error } = await client
    .from('professional_public_profiles')
    .select('id')
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

  return (data as { id?: string } | null)?.id || null;
}

async function updateProfessionalDuty(client: SupabaseClient, professionalId: string, isOnDuty: boolean) {
  const { error } = await client
    .from('professional_profiles')
    .update({ is_on_duty: isOnDuty })
    .eq('id', professionalId);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PROFESSIONAL_DUTY_UPDATE_FAILED',
      message: 'Unable to update professional duty status.',
      details: error.message,
    });
  }
}

async function updatePublicDuty(client: SupabaseClient, publicProfileId: string, isOnDuty: boolean) {
  const { error } = await client
    .from('professional_public_profiles')
    .update({ is_on_duty: isOnDuty })
    .eq('id', publicProfileId);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PUBLIC_DUTY_UPDATE_FAILED',
      message: 'Unable to update public duty status.',
      details: error.message,
    });
  }
}

function createSetProfessionalDutyRepository(client: SupabaseClient): SetProfessionalDutyRepository {
  return {
    findProfessionalProfileIdByAppUserId: (appUserId) => findProfessionalProfileIdByAppUserId(client, appUserId),
    findPublicProfileIdByProfessionalId: (professionalId) => findPublicProfileIdByProfessionalId(client, professionalId),
    updateProfessionalDuty: ({ professionalId, isOnDuty }) => updateProfessionalDuty(client, professionalId, isOnDuty),
    updatePublicDuty: ({ publicProfileId, isOnDuty }) => updatePublicDuty(client, publicProfileId, isOnDuty),
  };
}

export function createSetProfessionalDutyRuntime() {
  const client = createServiceRoleClient();
  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    async resolveAppUser(authUserId: string) {
      const appUser = await requireAppUserByAuthUserId(client, authUserId);
      requireRole(appUser, ['professional']);
      return appUser;
    },
    repository: createSetProfessionalDutyRepository(client),
  };
}

