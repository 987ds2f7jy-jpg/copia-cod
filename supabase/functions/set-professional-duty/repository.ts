import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { requireAppUserByAuthUserId, requireRole } from '../_shared/professional.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type { ProfessionalDutyProfile, SetProfessionalDutyRepository } from './types.ts';

async function findProfessionalDutyProfileByAppUserId(
  client: SupabaseClient,
  appUserId: string,
): Promise<ProfessionalDutyProfile | null> {
  const { data, error } = await client
    .from('professional_profiles')
    .select('id, status, specialty')
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

  const profile = data as { id?: string; status?: string; specialty?: string } | null;

  if (!profile?.id) {
    return null;
  }

  const { data: publicData, error: publicError } = await client
    .from('professional_public_profiles')
    .select('id, status')
    .eq('professional_profile_id', profile.id)
    .order('created_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (publicError) {
    throw new AppError({
      status: 500,
      code: 'PUBLIC_PROFILE_LOOKUP_FAILED',
      message: 'Unable to load public profile.',
      details: publicError.message,
    });
  }

  const publicProfile = publicData as { id?: string; status?: string } | null;

  return {
    professionalId: profile.id,
    status: String(profile.status || ''),
    specialty: String(profile.specialty || ''),
    publicProfileId: publicProfile?.id || null,
    publicStatus: publicProfile?.status || null,
  };
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
    findProfessionalDutyProfileByAppUserId: (appUserId) => findProfessionalDutyProfileByAppUserId(client, appUserId),
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

