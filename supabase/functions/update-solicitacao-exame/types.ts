import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';
import type { AppUserRecord } from '../_shared/appUsers.ts';
import type { SolicitacaoExameRecord } from '../create-solicitacao-exame/types.ts';

export type UpdateSolicitacaoExameInput = {
  solicitacaoId: string;
  queueId: string;
  status: '' | 'pending' | 'in_progress' | 'completed';
  medicoId: string;
};

export type SolicitacaoExameSummary = {
  id: string;
  paciente_id: string;
  status: string | null;
  tipo: string;
  queue_id: string | null;
  medico_id: string | null;
};

export type UpdateSolicitacaoExameParams = {
  solicitacaoId: string;
  queueId?: string;
  status?: 'pending' | 'in_progress' | 'completed';
  medicoId?: string;
};

export type UpdateSolicitacaoExameResult = {
  solicitacaoExame: SolicitacaoExameRecord;
};

export type UpdateSolicitacaoExameSuccessResponse = ApiSuccess<UpdateSolicitacaoExameResult>;
export type ErrorResponse = ApiErrorResponse;

export type UpdateSolicitacaoExameRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  findSolicitacaoExameById(solicitacaoId: string): Promise<SolicitacaoExameSummary | null>;
  updateSolicitacaoExame(params: UpdateSolicitacaoExameParams): Promise<SolicitacaoExameRecord>;
};

export type UpdateSolicitacaoExameCommand = {
  requestId: string;
  input: UpdateSolicitacaoExameInput;
  authenticatedUser: AuthenticatedUser;
};
