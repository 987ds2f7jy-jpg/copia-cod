import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';

export type GetSolicitacaoExameAtendimentoInput = {
  solicitacaoId: string;
};

export type ProfessionalIdentity = {
  appUserId: string;
  profileIds: string[];
  primaryProfileId: string;
};

export type PatientSummary = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  sex: string;
  birthDate: string;
};

export type SolicitacaoExameAtendimentoRecord = {
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
  dados_identificacao: Record<string, unknown> | null;
  informacoes_saude: Record<string, unknown> | null;
  dados_saude: Record<string, unknown> | null;
  especificacao_laudo: Record<string, unknown> | null;
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
  accepted_at: string | null;
  created_date: string | null;
  updated_at: string | null;
};

export type GetSolicitacaoExameAtendimentoResult = {
  solicitacaoExame: SolicitacaoExameAtendimentoRecord;
  patient: PatientSummary | null;
};

export type GetSolicitacaoExameAtendimentoSuccessResponse = ApiSuccess<GetSolicitacaoExameAtendimentoResult>;
export type ErrorResponse = ApiErrorResponse;

export type GetSolicitacaoExameAtendimentoRepository = {
  findProfessionalIdentityByAuthUserId(authUserId: string): Promise<ProfessionalIdentity | null>;
  findSolicitacaoExameById(solicitacaoId: string): Promise<SolicitacaoExameAtendimentoRecord | null>;
  findPatientById(patientId: string): Promise<PatientSummary | null>;
};

export type GetSolicitacaoExameAtendimentoCommand = {
  requestId: string;
  input: GetSolicitacaoExameAtendimentoInput;
  authenticatedUser: AuthenticatedUser;
};
