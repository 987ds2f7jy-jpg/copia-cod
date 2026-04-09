import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  AppUserRecord,
  ExistingProfessionalRecord,
  ProfessionalProfileRecord,
  ProfessionalPublicProfileRecord,
  RegisterProfessionalRepository,
} from './types.ts';

type AppUserRow = {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_active: boolean | null;
};

function mapAppUserRow(row: AppUserRow): AppUserRecord {
  return {
    id: row.id,
    authUserId: row.auth_user_id || '',
    fullName: row.full_name || '',
    email: row.email || '',
    phone: row.phone || '',
    role: row.role || '',
    isActive: Boolean(row.is_active),
  };
}

async function findAppUserByAuthUserId(client: SupabaseClient, authUserId: string) {
  const { data, error } = await client
    .from('app_users')
    .select('id, auth_user_id, full_name, email, phone, role, is_active')
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

async function findAppUserByEmail(client: SupabaseClient, email: string) {
  if (!email) {
    return null;
  }

  const { data, error } = await client
    .from('app_users')
    .select('id, auth_user_id, full_name, email, phone, role, is_active')
    .ilike('email', email)
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

function createRegisterProfessionalRepository(client: SupabaseClient): RegisterProfessionalRepository {
  return {
    async findAppUserBySupabaseIdentity({ authUserId, email }) {
      const byAuthUserId = await findAppUserByAuthUserId(client, authUserId);

      if (byAuthUserId?.id) {
        return mapAppUserRow(byAuthUserId);
      }

      const byEmail = await findAppUserByEmail(client, email);
      return byEmail?.id ? mapAppUserRow(byEmail) : null;
    },

    async createAppUser(params) {
      const { data, error } = await client
        .from('app_users')
        .insert({
          auth_user_id: params.authUserId,
          full_name: params.fullName,
          email: params.email,
          role: 'professional',
          is_active: true,
          phone: params.phone,
          cpf: params.cpf,
          birth_date: '',
          sex: params.sex,
          address: '',
          city: '',
          state: '',
          profile_complete: false,
        })
        .select('id, auth_user_id, full_name, email, phone, role, is_active')
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

    async updateAppUser(params) {
      const { data, error } = await client
        .from('app_users')
        .update({
          auth_user_id: params.authUserId,
          full_name: params.fullName,
          email: params.email,
          role: 'professional',
          phone: params.phone,
          cpf: params.cpf,
          sex: params.sex,
        })
        .eq('id', params.appUserId)
        .select('id, auth_user_id, full_name, email, phone, role, is_active')
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

    async findExistingProfessionalByUserId(userId: string): Promise<ExistingProfessionalRecord> {
      const [privateResult, publicResult] = await Promise.all([
        client.from('professional_profiles').select('id').eq('user_id', userId).limit(1),
        client.from('professional_public_profiles').select('id').eq('user_id', userId).limit(1),
      ]);

      if (privateResult.error) {
        throw new AppError({
          status: 500,
          code: 'PROFESSIONAL_PROFILE_LOOKUP_FAILED',
          message: 'Unable to verify existing professional profile.',
          details: privateResult.error.message,
        });
      }

      if (publicResult.error) {
        throw new AppError({
          status: 500,
          code: 'PROFESSIONAL_PUBLIC_PROFILE_LOOKUP_FAILED',
          message: 'Unable to verify existing professional public profile.',
          details: publicResult.error.message,
        });
      }

      return {
        privateProfileId: ((privateResult.data as { id: string }[] | null) || [])[0]?.id || null,
        publicProfileId: ((publicResult.data as { id: string }[] | null) || [])[0]?.id || null,
      };
    },

    async isSlugInUse(slug: string) {
      const { count, error } = await client
        .from('professional_public_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('slug', slug);

      if (error) {
        throw new AppError({
          status: 500,
          code: 'PUBLIC_PROFILE_SLUG_LOOKUP_FAILED',
          message: 'Unable to validate public profile slug.',
          details: error.message,
        });
      }

      return Number(count || 0) > 0;
    },

    async createProfessionalProfile(params): Promise<ProfessionalProfileRecord> {
      const { data, error } = await client
        .from('professional_profiles')
        .insert({
          user_id: params.userId,
          full_name: params.fullName,
          profession: params.profession,
          specialty: params.specialty,
          register_number: params.registerNumber,
          register_state: params.registerState,
          rqe: params.rqe,
          university: params.university,
          graduation_year: params.graduationYear,
          diploma_url: params.diplomaUrl,
          sex: params.sex,
          phone: params.phone,
          cpf: params.cpf,
          bio: params.bio,
          photo_url: params.photoUrl,
          is_on_duty: false,
          is_verified: false,
          status: 'pending',
          perfil_ativo: false,
          prioritario_ativo: false,
          rating: 0,
          total_reviews: 0,
        })
        .select('id, user_id, full_name, profession, specialty, status')
        .single();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'PROFESSIONAL_PROFILE_CREATE_FAILED',
          message: 'Unable to create professional profile.',
          details: error.message,
        });
      }

      return data as ProfessionalProfileRecord;
    },

    async createProfessionalPublicProfile(params): Promise<ProfessionalPublicProfileRecord> {
      const { data, error } = await client
        .from('professional_public_profiles')
        .insert({
          professional_profile_id: params.professionalProfileId,
          user_id: params.userId,
          full_name: params.fullName,
          slug: params.slug,
          profession: params.profession,
          specialty: params.specialty,
          register_number: params.registerNumber,
          register_state: params.registerState,
          rqe: params.rqe,
          bio: params.bio,
          photo_url: params.photoUrl,
          graduation_year: params.graduationYear,
          education: params.education,
          tags: params.tags,
          patient_types: params.patientTypes,
          modality: params.modality,
          office_city: params.officeCity,
          office_state: params.officeState,
          office_address: params.officeAddress,
          instagram_url: params.instagramUrl,
          gallery_urls: params.galleryUrls,
          is_on_duty: false,
          rating: 0,
          total_reviews: 0,
          perfil_ativo: false,
          prioritario_ativo: false,
          status: 'pending_review',
        })
        .select('id, professional_profile_id, user_id, full_name, slug, status')
        .single();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'PROFESSIONAL_PUBLIC_PROFILE_CREATE_FAILED',
          message: 'Unable to create professional public profile.',
          details: error.message,
        });
      }

      return data as ProfessionalPublicProfileRecord;
    },
  };
}

export function createRegisterProfessionalRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    repository: createRegisterProfessionalRepository(client),
  };
}
