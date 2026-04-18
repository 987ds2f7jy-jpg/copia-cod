import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { requireAppUserByAuthUserId, requireRole } from '../_shared/professional.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type { GetFinanceDashboardRepository } from './types.ts';

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

  return (data as Record<string, unknown> | null) || null;
}

async function listProfessionalIdsByAppUserId(client: SupabaseClient, appUserId: string) {
  const { data, error } = await client
    .from('professional_profiles')
    .select('id')
    .eq('user_id', appUserId)
    .order('created_date', { ascending: false });

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PROFESSIONAL_PROFILE_IDS_LOOKUP_FAILED',
      message: 'Unable to load professional profile ids.',
      details: error.message,
    });
  }

  return ((data as Array<{ id: string | null }> | null) || [])
    .map((row) => String(row?.id || '').trim())
    .filter(Boolean);
}

async function listAppointments(client: SupabaseClient, professionalIds: string[], limit: number) {
  if (professionalIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from('appointments')
    .select('*')
    .in('professional_id', professionalIds)
    .eq('payment_status', 'paid')
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

async function listSaques(client: SupabaseClient, professionalId: string, limit: number) {
  const { data, error } = await client
    .from('saques')
    .select('*')
    .eq('professional_id', professionalId)
    .order('created_date', { ascending: false })
    .limit(limit);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'SAQUES_LOOKUP_FAILED',
      message: 'Unable to load withdrawals.',
      details: error.message,
    });
  }

  return (data as Record<string, unknown>[] | null) || [];
}

async function getBankingData(client: SupabaseClient, professionalId: string) {
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

  return (data as Record<string, unknown> | null) || null;
}

function createGetFinanceDashboardRepository(client: SupabaseClient): GetFinanceDashboardRepository {
  return {
    findProfessionalByAppUserId: (appUserId) => findProfessionalByAppUserId(client, appUserId),
    listProfessionalIdsByAppUserId: (appUserId) => listProfessionalIdsByAppUserId(client, appUserId),
    listAppointments: (professionalIds, limit) => listAppointments(client, professionalIds, limit),
    listSaques: (professionalId, limit) => listSaques(client, professionalId, limit),
    getBankingData: (professionalId) => getBankingData(client, professionalId),
  };
}

export function createGetFinanceDashboardRuntime() {
  const client = createServiceRoleClient();
  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    async resolveAppUser(authUserId: string) {
      const appUser = await requireAppUserByAuthUserId(client, authUserId);
      requireRole(appUser, ['professional']);
      return appUser;
    },
    repository: createGetFinanceDashboardRepository(client),
  };
}

