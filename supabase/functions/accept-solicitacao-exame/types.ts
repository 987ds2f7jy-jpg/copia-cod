import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';
import type { AppUserRecord } from '../_shared/appUsers.ts';
import type { SolicitacaoExameRecord } from '../create-solicitacao-exame/types.ts';

export type AcceptSolicitacaoExameInput = {
  solicitacaoId: string;
};

export type ProfessionalProfileRecord = {
  id: string;
  userId: string;
  fullName: string;
  specialty: string;
  status: string;
  publicStatus: string;
};

export type AcceptSolicitacaoExameParams = {
  solicitacaoId: string;
  professionalProfileId: string;
  acceptedAt: string;
  expectedMedicoId: string | null;
};

export type AcceptedSolicitacaoExameRecord = SolicitacaoExameRecord & {
  accepted_at: string | null;
};

export type AcceptSolicitacaoExameResult = {
  solicitacaoExame: AcceptedSolicitacaoExameRecord;
};

export type AcceptSolicitacaoExameSuccessResponse = ApiSuccess<AcceptSolicitacaoExameResult>;
export type ErrorResponse = ApiErrorResponse;

export type AcceptSolicitacaoExameRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  findProfessionalProfileByAppUserId(appUserId: string): Promise<ProfessionalProfileRecord | null>;
  findSolicitacaoExameById(solicitacaoId: string): Promise<AcceptedSolicitacaoExameRecord | null>;
  acceptSolicitacaoExame(params: AcceptSolicitacaoExameParams): Promise<AcceptedSolicitacaoExameRecord | null>;
};

export type AcceptSolicitacaoExameCommand = {
  requestId: string;
  input: AcceptSolicitacaoExameInput;
  authenticatedUser: AuthenticatedUser;
};
