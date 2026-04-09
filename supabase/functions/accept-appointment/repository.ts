import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import type {
  AcceptAppointmentRepository,
  AcceptAppointmentTransactionRecord,
  AppUserRecord,
  ProfessionalProfileRecord,
} from './types.ts';

type SupabaseClient = ReturnType<typeof createClient>;

type ProfessionalProfileRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  specialty: string | null;
  status: string;
};

type LoadedProfessionalProfile = ProfessionalProfileRow & {
  source: 'professional_profiles' | 'professionals';
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
    .select('id, user_id, full_name, specialty, status')
    .eq('user_id', appUserId)
    .eq('status', 'active')
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

function mapTransactionError(error: { message?: string; details?: string } | null) {
  const code = String(error?.message || '').trim() || 'ACCEPT_APPOINTMENT_FAILED';
  const details = error?.details || undefined;

  if (code === 'APPOINTMENT_NOT_FOUND') {
    return new AppError({
      status: 404,
      code,
      message: 'Appointment not found.',
      details,
    });
  }

  if (code === 'APPOINTMENT_NOT_REQUESTED') {
    return new AppError({
      status: 409,
      code,
      message: 'Appointment is not in a requested state.',
      details,
    });
  }

  if (code === 'PROFESSIONAL_PROFILE_MISMATCH' || code === 'APPOINTMENT_NOT_ELIGIBLE_FOR_PROFESSIONAL') {
    return new AppError({
      status: 403,
      code,
      message: 'Professional is not allowed to accept this appointment.',
      details,
    });
  }

  if (code === 'PROFESSIONAL_PROFILE_NOT_FOUND' || code === 'PROFESSIONAL_PROFILE_NOT_ELIGIBLE') {
    return new AppError({
      status: 403,
      code,
      message: 'Active professional profile is required to accept appointments.',
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

  if (code === 'APPOINTMENT_SCHEDULE_CONFLICT') {
    return new AppError({
      status: 409,
      code,
      message: 'Professional already has another appointment at this time.',
      details,
    });
  }

  if (code === 'APPOINTMENT_SCHEDULE_MISSING') {
    return new AppError({
      status: 422,
      code,
      message: 'Appointment is missing scheduled datetime.',
      details,
    });
  }

  return new AppError({
    status: 500,
    code,
    message: 'Failed to accept appointment.',
    details,
  });
}

function createSupabaseAcceptAppointmentRepository(client: SupabaseClient): AcceptAppointmentRepository {
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

    async findActiveProfessionalProfileByUserId(appUserId: string): Promise<ProfessionalProfileRecord | null> {
      const profile =
        await loadProfessionalProfile(client, 'professional_profiles', appUserId) ||
        await loadProfessionalProfile(client, 'professionals', appUserId);

      if (!profile?.id) {
        return null;
      }

      return {
        appUserId,
        profileId: profile.id,
        fullName: profile.full_name || '',
        specialty: profile.specialty || '',
        source: profile.source,
      };
    },

    async acceptAppointment({
      appointmentId,
      professionalAppUserId,
      professionalProfileId,
    }): Promise<AcceptAppointmentTransactionRecord> {
      const { data, error } = await client
        .rpc('accept_appointment_transaction', {
          p_appointment_id: appointmentId,
          p_professional_app_user_id: professionalAppUserId,
          p_professional_profile_id: professionalProfileId,
        })
        .single();

      if (error) {
        throw mapTransactionError(error);
      }

      const row = data as AcceptAppointmentTransactionRecord | null;

      if (!row?.appointment_id || !row?.consulta_id) {
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

export function createAcceptAppointmentRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client),
    repository: createSupabaseAcceptAppointmentRepository(client),
  };
}
