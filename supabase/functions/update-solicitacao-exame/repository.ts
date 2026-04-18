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
    created_date,
    updated_at
  `;
}

function mapSolicitacaoUpdateError(error: { message?: string; details?: string }) {
  const code = String(error.message || '').trim();

  if (code === 'SOLICITACAO_EXAME_PAYMENT_REQUIRED') {
    return new AppError({
      status: 402,
      code,
      message: 'Exam/service request payment must be confirmed before workflow updates.',
      details: error.details,
    });
  }

  if (code === 'SOLICITACAO_EXAME_PAYMENT_CHARGE_REQUIRED') {
    return new AppError({
      status: 409,
      code,
      message: 'Exam/service request is missing the active payment charge required for workflow updates.',
      details: error.details,
    });
  }

  return new AppError({
    status: 500,
    code: 'SOLICITACAO_EXAME_UPDATE_FAILED',
    message: 'Unable to update exam request.',
    details: error.message,
  });
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
        throw mapSolicitacaoUpdateError(error);
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
