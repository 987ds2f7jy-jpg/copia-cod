import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import type {
  AcceptQueueEntryRepository,
  AcceptQueueEntryTransactionRecord,
  AppUserRecord,
  ProfessionalDutyRecord,
} from './types.ts';

type SupabaseClient = ReturnType<typeof createClient>;

type ProfessionalProfileRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  specialty: string | null;
  status: string;
  is_on_duty: boolean | null;
};

type LoadedProfessionalProfile = ProfessionalProfileRow & {
  source: 'professional_profiles' | 'professionals';
};

type ProfessionalPublicProfileRow = {
  id: string;
  professional_profile_id: string | null;
  user_id: string | null;
  specialty: string | null;
  status: string | null;
  is_on_duty: boolean | null;
};

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function createServiceRoleClient() {
  return createClient(getRequiredEnv('SUPABASE_URL'), getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function createSupabaseAuthUserLookup(client: SupabaseClient): AuthenticatedUserLookup {
  return async (accessToken: string) => {
    const { data, error } = await client.auth.getUser(accessToken);

    if (error || !data?.user?.id) {
      return null;
    }

    return {
      authUserId: data.user.id,
      email: data.user.email ?? null,
    };
  };
}

async function loadProfessionalProfile(
  client: SupabaseClient,
  tableName: 'professional_profiles' | 'professionals',
  appUserId: string,
): Promise<LoadedProfessionalProfile | null> {
  const { data, error } = await client
    .from(tableName)
    .select('id, user_id, full_name, specialty, status, is_on_duty')
    .eq('user_id', appUserId)
    .eq('status', 'approved')
    .limit(1);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PROFESSIONAL_PROFILE_LOOKUP_FAILED',
      message: 'Unable to resolve professional profile.',
      details: error.message,
    });
  }

  const row = (data?.[0] || null) as ProfessionalProfileRow | null;

  if (!row) {
    return null;
  }

  return {
    ...row,
    source: tableName,
  };
}

async function loadProfessionalPublicProfile(
  client: SupabaseClient,
  {
    profileId,
    appUserId,
  }: {
    profileId: string;
    appUserId: string;
  },
): Promise<ProfessionalPublicProfileRow | null> {
  const directMatch = await client
    .from('professional_public_profiles')
    .select('id, professional_profile_id, user_id, specialty, status, is_on_duty')
    .eq('professional_profile_id', profileId)
    .limit(1);

  if (directMatch.error) {
    throw new AppError({
      status: 500,
      code: 'PROFESSIONAL_PUBLIC_PROFILE_LOOKUP_FAILED',
      message: 'Unable to resolve professional public profile.',
      details: directMatch.error.message,
    });
  }

  const directRow = (directMatch.data?.[0] || null) as ProfessionalPublicProfileRow | null;

  if (directRow) {
    return directRow;
  }

  const fallbackMatch = await client
    .from('professional_public_profiles')
    .select('id, professional_profile_id, user_id, specialty, status, is_on_duty')
    .eq('user_id', appUserId)
    .limit(1);

  if (fallbackMatch.error) {
    throw new AppError({
      status: 500,
      code: 'PROFESSIONAL_PUBLIC_PROFILE_LOOKUP_FAILED',
      message: 'Unable to resolve professional public profile.',
      details: fallbackMatch.error.message,
    });
  }

  return (fallbackMatch.data?.[0] || null) as ProfessionalPublicProfileRow | null;
}

function mapTransactionError(error: { message?: string; details?: string } | null) {
  const code = String(error?.message || '').trim() || 'ACCEPT_QUEUE_ENTRY_FAILED';
  const details = error?.details || undefined;

  if (code === 'QUEUE_NOT_FOUND') {
    return new AppError({
      status: 404,
      code,
      message: 'Queue entry not found.',
      details,
    });
  }

  if (code === 'QUEUE_NOT_WAITING' || code === 'QUEUE_ALREADY_ASSIGNED') {
    return new AppError({
      status: 409,
      code,
      message: 'Queue entry is no longer available for assignment.',
      details,
    });
  }

  if (code === 'PATIENT_ALREADY_ASSIGNED' || code === 'PATIENT_ALREADY_IN_CONSULTA') {
    return new AppError({
      status: 409,
      code,
      message: 'Patient already has an active queue or consultation assignment.',
      details,
    });
  }

  if (code === 'PROFESSIONAL_ALREADY_ASSIGNED') {
    return new AppError({
      status: 409,
      code,
      message: 'Professional already has another active duty assignment.',
      details,
    });
  }

  if (code === 'PROFESSIONAL_NOT_ON_DUTY') {
    return new AppError({
      status: 409,
      code,
      message: 'Professional must be on duty to accept queue entries.',
      details,
    });
  }

  if (
    code === 'QUEUE_SPECIALTY_MISMATCH' ||
    code === 'PROFESSIONAL_SPECIALTY_NOT_ELIGIBLE' ||
    code === 'PROFESSIONAL_PROFILE_NOT_FOUND' ||
    code === 'PROFESSIONAL_PROFILE_NOT_ELIGIBLE'
  ) {
    return new AppError({
      status: 403,
      code,
      message: 'Professional is not allowed to accept this queue entry.',
      details,
    });
  }

  if (code === 'QUEUE_SPECIALTY_REQUIRED' || code === 'PROFESSIONAL_SPECIALTY_REQUIRED') {
    return new AppError({
      status: 422,
      code,
      message: 'Queue or professional specialty is invalid.',
      details,
    });
  }

  if (code === 'PROFESSIONAL_APP_USER_REQUIRED' || code === 'PROFESSIONAL_PROFILE_REQUIRED') {
    return new AppError({
      status: 500,
      code,
      message: 'Professional identity could not be resolved for the transaction.',
      details,
    });
  }

  return new AppError({
    status: 500,
    code,
    message: 'Failed to accept queue entry.',
    details,
  });
}

function createSupabaseAcceptQueueEntryRepository(client: SupabaseClient): AcceptQueueEntryRepository {
  return {
    async findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null> {
      const { data, error } = await client
        .from('app_users')
        .select('id, auth_user_id, full_name, role, is_active')
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

      if (!data?.id) {
        return null;
      }

      return {
        id: data.id,
        authUserId: data.auth_user_id || authUserId,
        fullName: data.full_name || '',
        role: data.role || '',
        isActive: Boolean(data.is_active),
      };
    },

    async findProfessionalDutyContextByUserId(appUserId: string): Promise<ProfessionalDutyRecord | null> {
      const profile =
        await loadProfessionalProfile(client, 'professional_profiles', appUserId);

      if (!profile?.id) {
        return null;
      }

      const publicProfile = await loadProfessionalPublicProfile(client, {
        profileId: profile.id,
        appUserId,
      });

      return {
        appUserId,
        profileId: profile.id,
        fullName: profile.full_name || '',
        specialty: publicProfile?.specialty || profile.specialty || '',
        isOnDuty: publicProfile
          ? Boolean(publicProfile.is_on_duty ?? profile.is_on_duty ?? false)
          : Boolean(profile.is_on_duty),
        publicStatus: publicProfile?.status || '',
        source: profile.source,
      };
    },

    async acceptQueueEntry({
      queueId,
      professionalAppUserId,
      professionalProfileId,
    }): Promise<AcceptQueueEntryTransactionRecord> {
      const { data, error } = await client
        .rpc('accept_queue_entry_transaction', {
          p_queue_id: queueId,
          p_professional_app_user_id: professionalAppUserId,
          p_professional_profile_id: professionalProfileId,
        })
        .single();

      if (error) {
        throw mapTransactionError(error);
      }

      const row = data as AcceptQueueEntryTransactionRecord | null;

      if (!row?.queue_id || !row?.consulta_id) {
        throw new AppError({
          status: 500,
          code: 'INVALID_RPC_RESPONSE',
          message: 'Database transaction returned an invalid response.',
        });
      }

      return row;
    },
  };
}

export function createAcceptQueueEntryRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client),
    repository: createSupabaseAcceptQueueEntryRepository(client),
  };
}
