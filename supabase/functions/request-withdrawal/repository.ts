import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { requireAppUserByAuthUserId, requireRole } from '../_shared/professional.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type { RequestWithdrawalRepository } from './types.ts';

const DIRECT_FINANCIAL_SERVICE_TYPES = ['checkup', 'renovacao_receitas'];

async function findProfessionalByAppUserId(client: SupabaseClient, appUserId: string) {
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

  return (data as { id: string } | null) || null;
}

async function listCompletedAppointmentsForMonth(
  client: SupabaseClient,
  professionalId: string,
  monthStart: string,
  monthEnd: string,
) {
  const { data, error } = await client
    .from('appointments')
    .select('status, date, price, preco, professional_net_amount, consulta_id')
    .eq('professional_id', professionalId)
    .gte('date', monthStart)
    .lte('date', monthEnd)
    .in('status', ['completed', 'CONCLUIDO']);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'APPOINTMENTS_LOOKUP_FAILED',
      message: 'Unable to load appointments for withdrawal calculation.',
      details: error.message,
    });
  }

  return (data as Array<{ price: number | null; preco: number | null; professional_net_amount?: number | null; status: string | null; date: string | null; consulta_id?: string | null }> | null) || [];
}

async function listCompletedServiceRequestsForMonth(
  client: SupabaseClient,
  professionalId: string,
  monthStart: string,
  monthEndExclusive: string,
) {
  const { data, error } = await client
    .from('solicitacoes_exames')
    .select('status, completed_at, quoted_professional_net_amount, consulta_id')
    .eq('medico_id', professionalId)
    .in('tipo', DIRECT_FINANCIAL_SERVICE_TYPES)
    .eq('status', 'completed')
    .eq('payment_status', 'paid')
    .gt('quoted_professional_net_amount', 0)
    .gte('completed_at', monthStart)
    .lt('completed_at', monthEndExclusive);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'SERVICE_REQUESTS_LOOKUP_FAILED',
      message: 'Unable to load completed service requests for withdrawal calculation.',
      details: error.message,
    });
  }

  return (data as Array<{ quoted_professional_net_amount: number | null; status: string | null; completed_at: string | null; consulta_id?: string | null }> | null) || [];
}

async function listPaidSaques(client: SupabaseClient, professionalId: string) {
  const { data, error } = await client
    .from('saques')
    .select('valor, status')
    .eq('professional_id', professionalId)
    .eq('status', 'pago');

  if (error) {
    throw new AppError({
      status: 500,
      code: 'SAQUES_LOOKUP_FAILED',
      message: 'Unable to load paid withdrawals.',
      details: error.message,
    });
  }

  return ((data as Array<{ valor: number | null }> | null) || []);
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

async function createSaque(
  client: SupabaseClient,
  params: { professionalId: string; valor: number; metodo: string; observacao: string },
) {
  const { data, error } = await client
    .from('saques')
    .insert({
      professional_id: params.professionalId,
      valor: params.valor,
      status: 'pendente',
      data_solicitacao: new Date().toISOString(),
      metodo: params.metodo,
      observacao: params.observacao,
    })
    .select('*')
    .single();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'WITHDRAWAL_CREATE_FAILED',
      message: 'Unable to create withdrawal request.',
      details: error.message,
    });
  }

  return data as Record<string, unknown>;
}

function createRequestWithdrawalRepository(client: SupabaseClient): RequestWithdrawalRepository {
  return {
    findProfessionalByAppUserId: (appUserId) => findProfessionalByAppUserId(client, appUserId),
    listCompletedAppointmentsForMonth: ({ professionalId, monthStart, monthEnd }) =>
      listCompletedAppointmentsForMonth(client, professionalId, monthStart, monthEnd),
    listCompletedServiceRequestsForMonth: ({ professionalId, monthStart, monthEndExclusive }) =>
      listCompletedServiceRequestsForMonth(client, professionalId, monthStart, monthEndExclusive),
    listPaidSaques: (professionalId) => listPaidSaques(client, professionalId),
    getBankingData: (professionalId) => getBankingData(client, professionalId),
    createSaque: ({ professionalId, valor, metodo, observacao }) => createSaque(client, { professionalId, valor, metodo, observacao }),
  };
}

export function createRequestWithdrawalRuntime() {
  const client = createServiceRoleClient();
  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    async resolveAppUser(authUserId: string) {
      const appUser = await requireAppUserByAuthUserId(client, authUserId);
      requireRole(appUser, ['professional']);
      return appUser;
    },
    repository: createRequestWithdrawalRepository(client),
  };
}

