import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { findAppUserByAuthUserId } from '../_shared/appUsers.ts';
import { AppError } from '../_shared/errors.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  FinishSolicitacaoExameAtendimentoRepository,
  FinishSolicitacaoExameLookupRecord,
  FinishSolicitacaoExameTransactionRow,
  ProfessionalIdentity,
} from './types.ts';

type ProfessionalProfileRow = {
  id: string;
  user_id: string | null;
};

function mapFinishTransactionError(error: { message?: string; details?: string }) {
  const code = String(error.message || '').trim();

  const mapped: Record<string, { status: number; message: string }> = {
    RECOMENDACOES_REQUIRED: {
      status: 400,
      message: 'Recommendations are required before finishing this request.',
    },
    SOLICITACAO_EXAME_NOT_FOUND: {
      status: 404,
      message: 'Exam/service request not found.',
    },
    PROFESSIONAL_PROFILE_NOT_FOUND: {
      status: 403,
      message: 'No professional profile was found for this user.',
    },
    SOLICITACAO_EXAME_ALREADY_COMPLETED: {
      status: 409,
      message: 'Exam/service request was already completed.',
    },
    SOLICITACAO_EXAME_NOT_IN_PROGRESS: {
      status: 409,
      message: 'Exam/service request is not in attendance.',
    },
    SOLICITACAO_EXAME_PAYMENT_REQUIRED: {
      status: 422,
      message: 'Exam/service request payment must be confirmed before finishing.',
    },
    SOLICITACAO_EXAME_PAYMENT_CHARGE_REQUIRED: {
      status: 409,
      message: 'Exam/service request is missing the active payment charge required for finishing.',
    },
    SOLICITACAO_EXAME_NOT_ASSIGNED_TO_PROFESSIONAL: {
      status: 404,
      message: 'Exam/service request not found.',
    },
    SOLICITACAO_EXAME_DIRECT_FLOW_UNSUPPORTED: {
      status: 422,
      message: 'This exam/service request cannot be finished in this screen.',
    },
    SOLICITACAO_EXAME_CONSULTA_LINK_INVALID: {
      status: 409,
      message: 'Exam/service request has an invalid consultation link.',
    },
  };

  if (mapped[code]) {
    return new AppError({
      status: mapped[code].status,
      code,
      message: mapped[code].message,
      details: error.details,
    });
  }

  return new AppError({
    status: 500,
    code: 'SOLICITACAO_EXAME_FINISH_FAILED',
    message: 'Unable to finish exam/service request attendance.',
    details: error.message,
  });
}

function createFinishSolicitacaoExameAtendimentoRepository(
  client: SupabaseClient,
): FinishSolicitacaoExameAtendimentoRepository {
  return {
    async findAppUserByAuthUserId(authUserId: string) {
      return findAppUserByAuthUserId(client, authUserId);
    },

    async findProfessionalIdentityByAppUserId(appUserId: string): Promise<ProfessionalIdentity | null> {
      const { data, error } = await client
        .from('professional_profiles')
        .select('id, user_id')
        .eq('user_id', appUserId)
        .order('created_date', { ascending: false });

      if (error) {
        throw new AppError({
          status: 500,
          code: 'PROFESSIONAL_PROFILE_LOOKUP_FAILED',
          message: 'Unable to resolve professional profile.',
          details: error.message,
        });
      }

      const profileIds = ((data as ProfessionalProfileRow[] | null) || [])
        .map((profile) => profile.id)
        .filter(Boolean);

      if (profileIds.length === 0) {
        return null;
      }

      return {
        appUserId,
        profileIds,
      };
    },

    async findSolicitacaoExameById(
      solicitacaoId: string,
    ): Promise<FinishSolicitacaoExameLookupRecord | null> {
      const { data, error } = await client
        .from('solicitacoes_exames')
        .select(`
          id,
          status,
          payment_status,
          medico_id,
          tipo,
          fluxo_destino,
          consulta_id,
          completed_at
        `)
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

      return (data as FinishSolicitacaoExameLookupRecord | null) || null;
    },

    async finishSolicitacaoExameAtendimento(params): Promise<FinishSolicitacaoExameTransactionRow> {
      const { data, error } = await client.rpc(
        'finish_solicitacao_exame_atendimento_transaction',
        {
          p_solicitacao_id: params.solicitacaoId,
          p_professional_profile_id: params.professionalProfileId,
          p_professional_app_user_id: params.professionalAppUserId,
          p_recomendacoes: params.recomendacoes,
        },
      );

      if (error) {
        throw mapFinishTransactionError(error);
      }

      const row = (Array.isArray(data) ? data[0] : data) as FinishSolicitacaoExameTransactionRow | null;

      if (!row?.result_solicitacao_id || !row?.result_consulta_id || !row?.result_prontuario_id) {
        throw new AppError({
          status: 500,
          code: 'SOLICITACAO_EXAME_FINISH_EMPTY_RESULT',
          message: 'Exam/service request finish transaction returned no result.',
        });
      }

      return row;
    },
  };
}

export function createFinishSolicitacaoExameAtendimentoRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    repository: createFinishSolicitacaoExameAtendimentoRepository(client),
  };
}
