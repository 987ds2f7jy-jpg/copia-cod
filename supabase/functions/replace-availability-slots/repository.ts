import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { requireAppUserByAuthUserId, requireRole } from '../_shared/professional.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type { AvailabilitySlotRecord, ReplaceAvailabilitySlotsRepository } from './types.ts';

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

async function deleteSlotsByProfessionalId(client: SupabaseClient, professionalId: string) {
  const { error } = await client
    .from('availability_slots')
    .delete()
    .eq('professional_id', professionalId);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'AVAILABILITY_DELETE_FAILED',
      message: 'Unable to clear availability slots.',
      details: error.message,
    });
  }
}

async function insertSlots(
  client: SupabaseClient,
  professionalId: string,
  slots: Array<{ weekday: number; time_slot: string }>,
) {
  if (slots.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from('availability_slots')
    .insert(slots.map((slot) => ({ ...slot, professional_id: professionalId })))
    .select('id, professional_id, weekday, time_slot');

  if (error) {
    throw new AppError({
      status: 500,
      code: 'AVAILABILITY_INSERT_FAILED',
      message: 'Unable to save availability slots.',
      details: error.message,
    });
  }

  return (data as AvailabilitySlotRecord[] | null) || [];
}

async function listSlotsByProfessionalId(client: SupabaseClient, professionalId: string) {
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

function createReplaceAvailabilitySlotsRepository(client: SupabaseClient): ReplaceAvailabilitySlotsRepository {
  return {
    findProfessionalProfileIdByAppUserId: (appUserId) => findProfessionalProfileIdByAppUserId(client, appUserId),
    deleteSlotsByProfessionalId: (professionalId) => deleteSlotsByProfessionalId(client, professionalId),
    insertSlots: ({ professionalId, slots }) => insertSlots(client, professionalId, slots),
    listSlotsByProfessionalId: (professionalId) => listSlotsByProfessionalId(client, professionalId),
  };
}

export function createReplaceAvailabilitySlotsRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    async resolveAppUser(authUserId: string) {
      const appUser = await requireAppUserByAuthUserId(client, authUserId);
      requireRole(appUser, ['professional']);
      return appUser;
    },
    repository: createReplaceAvailabilitySlotsRepository(client),
  };
}

