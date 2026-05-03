import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';
import type { AppUserRecord } from '../_shared/appUsers.ts';

export type FinishSolicitacaoExameAtendimentoInput = {
  solicitacaoId: string;
  recomendacoes: string;
};

export type ProfessionalIdentity = {
  appUserId: string;
  profileIds: string[];
};

export type FinishSolicitacaoExameLookupRecord = {
  id: string;
  status: string | null;
  payment_status: string | null;
  medico_id: string | null;
  tipo: string | null;
  fluxo_destino: string | null;
  consulta_id: string | null;
  completed_at: string | null;
};

export type FinishSolicitacaoExameTransactionRow = {
  result_solicitacao_id: string;
  result_consulta_id: string;
  result_prontuario_id: string;
  result_status: string;
  result_completed_at: string;
  result_recomendacoes: string;
};

export type FinishSolicitacaoExameAtendimentoResult = {
  solicitacaoExame: {
    id: string;
    status: string;
    consulta_id: string;
    completed_at: string;
  };
  consulta: {
    id: string;
  };
  prontuario: {
    id: string;
    consulta_id: string;
    recomendacoes: string;
  };
};

export type FinishSolicitacaoExameAtendimentoSuccessResponse =
  ApiSuccess<FinishSolicitacaoExameAtendimentoResult>;
export type ErrorResponse = ApiErrorResponse;

export type FinishSolicitacaoExameAtendimentoRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  findProfessionalIdentityByAppUserId(appUserId: string): Promise<ProfessionalIdentity | null>;
  findSolicitacaoExameById(solicitacaoId: string): Promise<FinishSolicitacaoExameLookupRecord | null>;
  finishSolicitacaoExameAtendimento(params: {
    solicitacaoId: string;
    professionalProfileId: string;
    professionalAppUserId: string;
    recomendacoes: string;
  }): Promise<FinishSolicitacaoExameTransactionRow>;
};

export type FinishSolicitacaoExameAtendimentoCommand = {
  requestId: string;
  input: FinishSolicitacaoExameAtendimentoInput;
  authenticatedUser: AuthenticatedUser;
};
