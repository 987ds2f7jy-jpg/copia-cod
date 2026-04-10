import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { requireAppUserByAuthUserId, requireRole } from '../_shared/professional.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type { GetProfessionalDashboardRepository } from './types.ts';

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
    .createSignedUrl(path, 60 * 60);

  if (error || !data?.signedUrl) {
    return path;
  }

  return data.signedUrl;
}

async function decorateProfessionalProfile(client: SupabaseClient, profile: Record<string, unknown> | null) {
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    diploma_path: profile.diploma_url,
    diploma_url: await createSignedUploadUrl(client, profile.diploma_url),
    photo_path: profile.photo_url,
    photo_url: await createSignedUploadUrl(client, profile.photo_url),
  };
}

async function decoratePublicProfile(client: SupabaseClient, profile: Record<string, unknown> | null) {
  if (!profile) {
    return null;
  }

  const galleryUrls = Array.isArray(profile.gallery_urls) ? profile.gallery_urls : [];

  return {
    ...profile,
    photo_path: profile.photo_url,
    photo_url: await createSignedUploadUrl(client, profile.photo_url),
    gallery_paths: galleryUrls,
    gallery_urls: await Promise.all(galleryUrls.map((url) => createSignedUploadUrl(client, url))),
  };
}

async function findProfessionalByAppUserId(client: SupabaseClient, appUserId: string) {
  const { data, error } = await client
    .from('professional_profiles')
    .select('*')
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

  return decorateProfessionalProfile(client, (data as Record<string, unknown> | null) || null);
}

async function findPublicProfileByProfessionalId(client: SupabaseClient, professionalId: string) {
  const { data, error } = await client
    .from('professional_public_profiles')
    .select('*')
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

  return decoratePublicProfile(client, (data as Record<string, unknown> | null) || null);
}

async function listAvailabilitySlots(client: SupabaseClient, professionalId: string) {
  const { data, error } = await client
    .from('availability_slots')
    .select('*')
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

  return (data as Record<string, unknown>[] | null) || [];
}

async function listAppointments(client: SupabaseClient, professionalId: string, limit: number) {
  const { data, error } = await client
    .from('appointments')
    .select('*')
    .eq('professional_id', professionalId)
    .order('date', { ascending: false })
    .limit(limit);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'APPOINTMENTS_LOOKUP_FAILED',
      message: 'Unable to load appointments.',
      details: error.message,
    });
  }

  return (data as Record<string, unknown>[] | null) || [];
}

async function listQueueAll(client: SupabaseClient, professionalId: string, limit: number) {
  const { data, error } = await client
    .from('queues')
    .select('*')
    .eq('assigned_professional_id', professionalId)
    .order('created_date', { ascending: false })
    .limit(limit);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'QUEUE_LOOKUP_FAILED',
      message: 'Unable to load queue entries.',
      details: error.message,
    });
  }

  return (data as Record<string, unknown>[] | null) || [];
}

async function listQueueWaitingBySpecialty(client: SupabaseClient, specialty: string, limit: number) {
  const { data, error } = await client
    .from('queues')
    .select('*')
    .eq('specialty', specialty)
    .eq('status', 'waiting')
    .order('created_date', { ascending: true })
    .limit(limit);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'QUEUE_WAITING_LOOKUP_FAILED',
      message: 'Unable to load waiting queue.',
      details: error.message,
    });
  }

  return (data as Record<string, unknown>[] | null) || [];
}

async function listPendingQuestions(client: SupabaseClient, specialty: string, limit: number) {
  const { data, error } = await client
    .from('questions')
    .select('*')
    .eq('status', 'PENDENTE')
    .eq('specialty', specialty)
    .order('created_date', { ascending: true })
    .limit(limit);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'QUESTIONS_LOOKUP_FAILED',
      message: 'Unable to load questions.',
      details: error.message,
    });
  }

  return (data as Record<string, unknown>[] | null) || [];
}

async function listPendingQuestionsAll(client: SupabaseClient, limit: number) {
  const { data, error } = await client
    .from('questions')
    .select('*')
    .eq('status', 'PENDENTE')
    .eq('specialty', 'Todas')
    .order('created_date', { ascending: true })
    .limit(limit);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'QUESTIONS_LOOKUP_FAILED',
      message: 'Unable to load questions.',
      details: error.message,
    });
  }

  return (data as Record<string, unknown>[] | null) || [];
}

async function listAnsweredQuestions(client: SupabaseClient, professionalId: string, limit: number) {
  const { data, error } = await client
    .from('questions')
    .select('*')
    .eq('answered_by_professional_id', professionalId)
    .order('answered_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'QUESTIONS_LOOKUP_FAILED',
      message: 'Unable to load answered questions.',
      details: error.message,
    });
  }

  return (data as Record<string, unknown>[] | null) || [];
}

async function listReviews(client: SupabaseClient, professionalId: string, limit: number) {
  const { data, error } = await client
    .from('reviews')
    .select('*')
    .eq('professional_id', professionalId)
    .order('created_date', { ascending: false })
    .limit(limit);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'REVIEWS_LOOKUP_FAILED',
      message: 'Unable to load reviews.',
      details: error.message,
    });
  }

  return (data as Record<string, unknown>[] | null) || [];
}

function createGetProfessionalDashboardRepository(client: SupabaseClient): GetProfessionalDashboardRepository {
  return {
    findProfessionalByAppUserId: (appUserId) => findProfessionalByAppUserId(client, appUserId),
    findPublicProfileByProfessionalId: (professionalId) => findPublicProfileByProfessionalId(client, professionalId),
    listAvailabilitySlots: (professionalId) => listAvailabilitySlots(client, professionalId),
    listAppointments: (professionalId, limit) => listAppointments(client, professionalId, limit),
    listQueueAll: (professionalId, limit) => listQueueAll(client, professionalId, limit),
    listQueueWaitingBySpecialty: ({ specialty, limit }) => listQueueWaitingBySpecialty(client, specialty, limit),
    listPendingQuestions: ({ specialty, limit }) => listPendingQuestions(client, specialty, limit),
    listPendingQuestionsAll: (limit) => listPendingQuestionsAll(client, limit),
    listAnsweredQuestions: ({ professionalId, limit }) => listAnsweredQuestions(client, professionalId, limit),
    listReviews: (professionalId, limit) => listReviews(client, professionalId, limit),
  };
}

export function createGetProfessionalDashboardRuntime() {
  const client = createServiceRoleClient();
  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    async resolveAppUser(authUserId: string) {
      const appUser = await requireAppUserByAuthUserId(client, authUserId);
      requireRole(appUser, ['professional']);
      return appUser;
    },
    repository: createGetProfessionalDashboardRepository(client),
  };
}

