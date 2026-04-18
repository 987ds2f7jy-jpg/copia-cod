import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';
import type { AppUserRecord } from '../_shared/appUsers.ts';
import type { ResolveServicePricingInput, ResolvedServicePricing } from '../_shared/pricing/types.ts';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export type JsonObject = Record<string, JsonValue>;

export type CreateSolicitacaoExameInput = {
  tipo: 'checkup' | 'especificos' | 'renovacao_receitas' | 'laudo_medico';
  exameSolicitado: string;
  motivo: string;
  sintomas: string;
  assintomaticoConfirmado: boolean;
  fluxoDestino: string;
  especialidadeDestino: string;
  nomeMedicamento: string;
  dosagem: string;
  frequencia: string;
  arquivoReceitaUrl: string;
  dadosIdentificacao: JsonObject;
  informacoesSaude: JsonObject;
  especificacaoLaudo: JsonObject;
  arquivos: string[];
  queueId: string;
};

export type SolicitacaoExameRecord = {
  id: string;
  paciente_id: string;
  paciente_nome: string | null;
  paciente_email: string | null;
  paciente_telefone: string | null;
  tipo: string;
  exame_solicitado: string | null;
  motivo: string | null;
  sintomas: string | null;
  status: string | null;
  assintomatico_confirmado: boolean | null;
  medico_id: string | null;
  fluxo_destino: string | null;
  especialidade_destino: string | null;
  nome_medicamento: string | null;
  dosagem: string | null;
  frequencia: string | null;
  arquivo_receita_url: string | null;
  dados_identificacao: JsonObject | null;
  informacoes_saude: JsonObject | null;
  dados_saude: JsonObject | null;
  especificacao_laudo: JsonObject | null;
  arquivos: string[] | null;
  arquivos_urls: string[] | null;
  queue_id: string | null;
  service_code: string | null;
  price_source: string | null;
  quoted_gross_price: number | null;
  quoted_platform_fee_percent: number | null;
  quoted_platform_fee_amount: number | null;
  quoted_professional_net_amount: number | null;
  pricing_rule_id: string | null;
  fee_rule_id: string | null;
  payment_status: string | null;
  current_payment_charge_id: string | null;
  created_date: string;
  updated_at: string;
};

export type CreateSolicitacaoExameParams = {
  patient: AppUserRecord;
  tipo: CreateSolicitacaoExameInput['tipo'];
  exameSolicitado: string;
  motivo: string;
  sintomas: string;
  status: 'pending' | 'in_progress' | 'completed';
  assintomaticoConfirmado: boolean;
  medicoId: string;
  fluxoDestino: 'dashboard' | 'plantao';
  especialidadeDestino: string;
  nomeMedicamento: string;
  dosagem: string;
  frequencia: string;
  arquivoReceitaUrl: string;
  dadosIdentificacao: JsonObject;
  informacoesSaude: JsonObject;
  dadosSaude: JsonObject;
  especificacaoLaudo: JsonObject;
  arquivos: string[];
  arquivosUrls: string[];
  queueId: string;
  pricing: ResolvedServicePricing;
};

export type CreateSolicitacaoExameResult = {
  solicitacaoExame: SolicitacaoExameRecord;
};

export type CreateSolicitacaoExameSuccessResponse = ApiSuccess<CreateSolicitacaoExameResult>;
export type ErrorResponse = ApiErrorResponse;

export type CreateSolicitacaoExameRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  resolveServicePricing(input: ResolveServicePricingInput): Promise<ResolvedServicePricing>;
  createSolicitacaoExame(params: CreateSolicitacaoExameParams): Promise<SolicitacaoExameRecord>;
};

export type CreateSolicitacaoExameCommand = {
  requestId: string;
  input: CreateSolicitacaoExameInput;
  authenticatedUser: AuthenticatedUser;
};
