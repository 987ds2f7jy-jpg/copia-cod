import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';
import type { AppUserRecord } from '../_shared/appUsers.ts';

export type DeleteSolicitacaoExameInput = {
  solicitacaoId: string;
};

export type SolicitacaoExameSummary = {
  id: string;
  paciente_id: string;
  status: string | null;
};

export type DeleteSolicitacaoExameResult = {
  deleted: boolean;
  solicitacaoExameId: string;
};

export type DeleteSolicitacaoExameSuccessResponse = ApiSuccess<DeleteSolicitacaoExameResult>;
export type ErrorResponse = ApiErrorResponse;

export type DeleteSolicitacaoExameRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  findSolicitacaoExameById(solicitacaoId: string): Promise<SolicitacaoExameSummary | null>;
  deleteSolicitacaoExame(solicitacaoId: string): Promise<void>;
};

export type DeleteSolicitacaoExameCommand = {
  requestId: string;
  input: DeleteSolicitacaoExameInput;
  authenticatedUser: AuthenticatedUser;
};
