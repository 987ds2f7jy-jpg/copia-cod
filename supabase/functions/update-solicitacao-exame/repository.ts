import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { findAppUserByAuthUserId } from '../_shared/appUsers.ts';
import { AppError } from '../_shared/errors.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type { SolicitacaoExameRecord } from '../create-solicitacao-exame/types.ts';
import type {
  SolicitacaoExameSummary,
  UpdateSolicitacaoExameParams,
  UpdateSolicitacaoExameRepository,
} from './types.ts';

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
    created_date,
    updated_at
  `;
}

function createUpdateSolicitacaoExameRepository(client: SupabaseClient): UpdateSolicitacaoExameRepository {
  return {
    async findAppUserByAuthUserId(authUserId: string) {
      return findAppUserByAuthUserId(client, authUserId);
    },

    async findSolicitacaoExameById(solicitacaoId: string): Promise<SolicitacaoExameSummary | null> {
      const { data, error } = await client
        .from('solicitacoes_exames')
        .select('id, paciente_id, status, tipo, queue_id, medico_id')
        .eq('id', solicitacaoId)
        .maybeSingle();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'SOLICITACAO_EXAME_LOOKUP_FAILED',
          message: 'Unable to load exam request.',
          details: error.message,
        });
      }

      return (data as SolicitacaoExameSummary | null) || null;
    },

    async updateSolicitacaoExame(params: UpdateSolicitacaoExameParams): Promise<SolicitacaoExameRecord> {
      const patch: Record<string, string> = {};

      if (params.queueId !== undefined) {
        patch.queue_id = params.queueId;
      }

      if (params.status !== undefined) {
        patch.status = params.status;
      }

      if (params.medicoId !== undefined) {
        patch.medico_id = params.medicoId;
      }

      const { data, error } = await client
        .from('solicitacoes_exames')
        .update(patch)
        .eq('id', params.solicitacaoId)
        .select(selectSolicitacaoExameColumns())
        .single();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'SOLICITACAO_EXAME_UPDATE_FAILED',
          message: 'Unable to update exam request.',
          details: error.message,
        });
      }

      const row = data as SolicitacaoExameRecord | null;

      if (!row?.id) {
        throw new AppError({
          status: 500,
          code: 'INVALID_SOLICITACAO_EXAME_RESPONSE',
          message: 'Exam request update returned an invalid response.',
        });
      }

      return row;
    },
  };
}

export function createUpdateSolicitacaoExameRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    repository: createUpdateSolicitacaoExameRepository(client),
  };
}
