import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { requireAppUserByAuthUserId, requireRole } from '../_shared/professional.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type { GetFinanceDashboardRepository } from './types.ts';

const DIRECT_FINANCIAL_SERVICE_TYPES = ['checkup', 'renovacao_receitas'];

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

function mapCompletedServiceRequest(row: Record<string, unknown>) {
  const completedAt = String(row.completed_at || '').trim();
  const createdDate = String(row.created_date || '').trim();
  const serviceDate = completedAt || createdDate;

  return {
    ...row,
    type: 'service_request',
    service_type: row.tipo || '',
    date: serviceDate ? serviceDate.slice(0, 10) : '',
    completed_at: completedAt,
    created_at: createdDate,
    gross_price: row.quoted_gross_price,
    platform_fee_amount: row.quoted_platform_fee_amount,
    professional_net_amount: row.quoted_professional_net_amount,
    patient_name: row.paciente_nome || row.patient_name || '',
  };
}

async function listCompletedServiceRequests(client: SupabaseClient, professionalIds: string[], limit: number) {
  if (professionalIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from('solicitacoes_exames')
    .select('*')
    .in('medico_id', professionalIds)
    .in('tipo', DIRECT_FINANCIAL_SERVICE_TYPES)
    .eq('status', 'completed')
    .eq('payment_status', 'paid')
    .gt('quoted_professional_net_amount', 0)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'SERVICE_REQUESTS_LOOKUP_FAILED',
      message: 'Unable to load completed service requests.',
      details: error.message,
    });
  }

  return ((data as Record<string, unknown>[] | null) || []).map(mapCompletedServiceRequest);
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
    listCompletedServiceRequests: (professionalIds, limit) => listCompletedServiceRequests(client, professionalIds, limit),
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

