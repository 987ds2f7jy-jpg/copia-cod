import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { requireAppUserByAuthUserId, requireRole } from '../_shared/professional.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  ProfessionalBankingDataRecord,
  UpsertProfessionalBankingDataRepository,
} from './types.ts';

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

async function findExistingBankingData(client: SupabaseClient, professionalId: string) {
  const { data, error } = await client
    .from('professional_banking_data')
    .select('*')
    .eq('professional_id', professionalId)
    .order('created_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'BANKING_LOOKUP_FAILED',
      message: 'Unable to load banking data.',
      details: error.message,
    });
  }

  return (data as ProfessionalBankingDataRecord | null) || null;
}

async function insertBankingData(client: SupabaseClient, professionalId: string, record: Record<string, unknown>) {
  const { data, error } = await client
    .from('professional_banking_data')
    .insert({
      ...record,
      professional_id: professionalId,
    })
    .select('*')
    .single();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'BANKING_CREATE_FAILED',
      message: 'Unable to save banking data.',
      details: error.message,
    });
  }

  return data as ProfessionalBankingDataRecord;
}

async function updateBankingData(client: SupabaseClient, bankingDataId: string, record: Record<string, unknown>) {
  const { data, error } = await client
    .from('professional_banking_data')
    .update(record)
    .eq('id', bankingDataId)
    .select('*')
    .single();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'BANKING_UPDATE_FAILED',
      message: 'Unable to update banking data.',
      details: error.message,
    });
  }

  return data as ProfessionalBankingDataRecord;
}

function createUpsertProfessionalBankingDataRepository(client: SupabaseClient): UpsertProfessionalBankingDataRepository {
  return {
    findProfessionalProfileIdByAppUserId: (appUserId) => findProfessionalProfileIdByAppUserId(client, appUserId),
    findExistingBankingData: (professionalId) => findExistingBankingData(client, professionalId),
    insertBankingData: ({ professionalId, record }) => insertBankingData(client, professionalId, record),
    updateBankingData: ({ bankingDataId, record }) => updateBankingData(client, bankingDataId, record),
  };
}

export function createUpsertProfessionalBankingDataRuntime() {
  const client = createServiceRoleClient();
  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    async resolveAppUser(authUserId: string) {
      const appUser = await requireAppUserByAuthUserId(client, authUserId);
      requireRole(appUser, ['professional']);
      return appUser;
    },
    repository: createUpsertProfessionalBankingDataRepository(client),
  };
}

