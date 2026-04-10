import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { requireAppUserByAuthUserId, requireRole } from '../_shared/professional.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type { ReviewProfessionalApplicationRepository } from './types.ts';

async function findPublicProfileById(client: SupabaseClient, publicProfileId: string) {
  const { data, error } = await client
    .from('professional_public_profiles')
    .select('id, professional_profile_id')
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

  return (data as { id: string; professional_profile_id: string } | null) || null;
}

async function updatePublicProfile(client: SupabaseClient, publicProfileId: string, updates: Record<string, unknown>) {
  const { error } = await client
    .from('professional_public_profiles')
    .update(updates)
    .eq('id', publicProfileId);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PUBLIC_PROFILE_UPDATE_FAILED',
      message: 'Unable to update public profile.',
      details: error.message,
    });
  }
}

async function updatePrivateProfile(client: SupabaseClient, professionalId: string, updates: Record<string, unknown>) {
  const { error } = await client
    .from('professional_profiles')
    .update(updates)
    .eq('id', professionalId);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PROFESSIONAL_PROFILE_UPDATE_FAILED',
      message: 'Unable to update professional profile.',
      details: error.message,
    });
  }
}

function createReviewProfessionalApplicationRepository(client: SupabaseClient): ReviewProfessionalApplicationRepository {
  return {
    findPublicProfileById: (publicProfileId) => findPublicProfileById(client, publicProfileId),
    updatePublicProfile: ({ publicProfileId, updates }) => updatePublicProfile(client, publicProfileId, updates),
    updatePrivateProfile: ({ professionalId, updates }) => updatePrivateProfile(client, professionalId, updates),
  };
}

export function createReviewProfessionalApplicationRuntime() {
  const client = createServiceRoleClient();
  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    async resolveAdmin(authUserId: string) {
      const appUser = await requireAppUserByAuthUserId(client, authUserId);
      requireRole(appUser, ['admin']);
      return appUser;
    },
    repository: createReviewProfessionalApplicationRepository(client),
  };
}

