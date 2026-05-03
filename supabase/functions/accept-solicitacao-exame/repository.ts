import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { findAppUserByAuthUserId } from '../_shared/appUsers.ts';
import { AppError } from '../_shared/errors.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  AcceptSolicitacaoExameParams,
  AcceptSolicitacaoExameRepository,
  AcceptedSolicitacaoExameRecord,
  ProfessionalProfileRecord,
} from './types.ts';

type ProfessionalProfileRow = {
  id: string;
  user_id: string | null;
  full_name: string | null;
  specialty: string | null;
  status: string | null;
};

type ProfessionalPublicProfileRow = {
  status: string | null;
};

function selectSolicitacaoExameColumns() {
  return `
    id,
    paciente_id,
    paciente_nome,
    paciente_email,
    paciente_telefone,
    tipo,
    exame_solicitado,
    motivo,
    sintomas,
    status,
    assintomatico_confirmado,
    medico_id,
    fluxo_destino,
    especialidade_destino,
    nome_medicamento,
    dosagem,
    frequencia,
    arquivo_receita_url,
    dados_identificacao,
    informacoes_saude,
    dados_saude,
    especificacao_laudo,
    arquivos,
    arquivos_urls,
    queue_id,
    service_code,
    price_source,
    quoted_gross_price,
    quoted_platform_fee_percent,
    quoted_platform_fee_amount,
    quoted_professional_net_amount,
    pricing_rule_id,
    fee_rule_id,
    payment_status,
    current_payment_charge_id,
    accepted_at,
    created_date,
    updated_at
  `;
}

function mapSolicitacaoAcceptError(error: { message?: string; details?: string }) {
  const code = String(error.message || '').trim();

  if (code === 'SOLICITACAO_EXAME_PAYMENT_REQUIRED') {
    return new AppError({
      status: 422,
      code,
      message: 'Exam/service request payment must be confirmed before acceptance.',
      details: error.details,
    });
  }

  if (code === 'SOLICITACAO_EXAME_PAYMENT_CHARGE_REQUIRED') {
    return new AppError({
      status: 409,
      code,
      message: 'Exam/service request is missing the active payment charge required for acceptance.',
      details: error.details,
    });
  }

  return new AppError({
    status: 500,
    code: 'SOLICITACAO_EXAME_ACCEPT_FAILED',
    message: 'Unable to accept exam/service request.',
    details: error.message,
  });
}

async function findPublicProfileStatus(client: SupabaseClient, professionalProfileId: string) {
  const { data, error } = await client
    .from('professional_public_profiles')
    .select('status')
    .eq('professional_profile_id', professionalProfileId)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PROFESSIONAL_PUBLIC_PROFILE_LOOKUP_FAILED',
      message: 'Unable to resolve professional public profile.',
      details: error.message,
    });
  }

  return ((data as ProfessionalPublicProfileRow | null)?.status || '').trim();
}

function createAcceptSolicitacaoExameRepository(client: SupabaseClient): AcceptSolicitacaoExameRepository {
  return {
    async findAppUserByAuthUserId(authUserId: string) {
      return findAppUserByAuthUserId(client, authUserId);
    },

    async findProfessionalProfileByAppUserId(appUserId: string): Promise<ProfessionalProfileRecord | null> {
      const { data, error } = await client
        .from('professional_profiles')
        .select('id, user_id, full_name, specialty, status')
        .eq('user_id', appUserId)
        .order('created_date', { ascending: false })
        .limit(1);

      if (error) {
        throw new AppError({
          status: 500,
          code: 'PROFESSIONAL_PROFILE_LOOKUP_FAILED',
          message: 'Unable to resolve professional profile.',
          details: error.message,
        });
      }

      const row = ((data as ProfessionalProfileRow[] | null) || [])[0] || null;

      if (!row?.id) {
        return null;
      }

      return {
        id: row.id,
        userId: row.user_id || appUserId,
        fullName: row.full_name || '',
        specialty: row.specialty || '',
        status: row.status || '',
        publicStatus: await findPublicProfileStatus(client, row.id),
      };
    },

    async findSolicitacaoExameById(solicitacaoId: string): Promise<AcceptedSolicitacaoExameRecord | null> {
      const { data, error } = await client
        .from('solicitacoes_exames')
        .select(selectSolicitacaoExameColumns())
        .eq('id', solicitacaoId)
        .maybeSingle();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'SOLICITACAO_EXAME_LOOKUP_FAILED',
          message: 'Unable to load exam/service request.',
          details: error.message,
        });
      }

      return (data as AcceptedSolicitacaoExameRecord | null) || null;
    },

    async acceptSolicitacaoExame(params: AcceptSolicitacaoExameParams): Promise<AcceptedSolicitacaoExameRecord | null> {
      let query = client
        .from('solicitacoes_exames')
        .update({
          status: 'in_progress',
          medico_id: params.professionalProfileId,
          accepted_at: params.acceptedAt,
        })
        .eq('id', params.solicitacaoId)
        .eq('status', 'pending')
        .eq('payment_status', 'paid')
        .eq('fluxo_destino', 'dashboard')
        .in('tipo', ['checkup', 'renovacao_receitas']);

      query = params.expectedMedicoId === null
        ? query.is('medico_id', null)
        : query.eq('medico_id', params.expectedMedicoId);

      const { data, error } = await query
        .select(selectSolicitacaoExameColumns())
        .maybeSingle();

      if (error) {
        throw mapSolicitacaoAcceptError(error);
      }

      return (data as AcceptedSolicitacaoExameRecord | null) || null;
    },
  };
}

export function createAcceptSolicitacaoExameRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    repository: createAcceptSolicitacaoExameRepository(client),
  };
}
