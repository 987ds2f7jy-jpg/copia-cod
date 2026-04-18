import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { findAppUserByAuthUserId } from '../_shared/appUsers.ts';
import { AppError } from '../_shared/errors.ts';
import { createPaymentCharge } from '../_shared/payments/create-payment-charge.ts';
import { resolveServicePricing } from '../_shared/pricing/resolve-service-pricing.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  CreateSolicitacaoExameRepository,
  CreateSolicitacaoExameParams,
  SolicitacaoExameRecord,
} from './types.ts';

function createCreateSolicitacaoExameRepository(client: SupabaseClient): CreateSolicitacaoExameRepository {
  return {
    async findAppUserByAuthUserId(authUserId: string) {
      return findAppUserByAuthUserId(client, authUserId);
    },

    async resolveServicePricing(input) {
      return resolveServicePricing(client, input);
    },

    async createSolicitacaoExame(params: CreateSolicitacaoExameParams): Promise<SolicitacaoExameRecord> {
      const { data, error } = await client
        .from('solicitacoes_exames')
        .insert({
          paciente_id: params.patient.id,
          paciente_nome: params.patient.fullName || params.patient.email || 'Paciente',
          paciente_email: params.patient.email,
          paciente_telefone: params.patient.phone,
          tipo: params.tipo,
          exame_solicitado: params.exameSolicitado,
          motivo: params.motivo,
          sintomas: params.sintomas,
          status: params.status,
          assintomatico_confirmado: params.assintomaticoConfirmado,
          medico_id: params.medicoId,
          fluxo_destino: params.fluxoDestino,
          especialidade_destino: params.especialidadeDestino,
          nome_medicamento: params.nomeMedicamento,
          dosagem: params.dosagem,
          frequencia: params.frequencia,
          arquivo_receita_url: params.arquivoReceitaUrl,
          dados_identificacao: params.dadosIdentificacao,
          informacoes_saude: params.informacoesSaude,
          dados_saude: params.dadosSaude,
          especificacao_laudo: params.especificacaoLaudo,
          arquivos: params.arquivos,
          arquivos_urls: params.arquivosUrls,
          queue_id: params.queueId,
          service_code: params.pricing.serviceCode,
          price_source: params.pricing.priceSource,
          quoted_gross_price: params.pricing.grossPrice,
          quoted_platform_fee_percent: params.pricing.platformFeePercent,
          quoted_platform_fee_amount: params.pricing.platformFeeAmount,
          quoted_professional_net_amount: params.pricing.professionalNetAmount,
          pricing_rule_id: params.pricing.pricingRuleId,
          fee_rule_id: params.pricing.feeRuleId,
          payment_status: 'payment_pending',
        })
        .select(`
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
        `)
        .single();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'SOLICITACAO_EXAME_CREATE_FAILED',
          message: 'Unable to create exam request.',
          details: error.message,
        });
      }

      const row = data as SolicitacaoExameRecord | null;

      if (!row?.id) {
        throw new AppError({
          status: 500,
          code: 'INVALID_SOLICITACAO_EXAME_RESPONSE',
          message: 'Exam request creation returned an invalid response.',
        });
      }

      const paymentCharge = await createPaymentCharge(client, {
        ownerType: 'solicitacao_exame',
        ownerId: row.id,
        amount: Number(row.quoted_gross_price),
        currency: 'BRL',
      });

      return {
        ...row,
        current_payment_charge_id: paymentCharge.paymentChargeId,
      };
    },
  };
}

export function createCreateSolicitacaoExameRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    repository: createCreateSolicitacaoExameRepository(client),
  };
}
