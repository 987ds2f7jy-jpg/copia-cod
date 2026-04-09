import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';

export type LeaveQueueInput = {
  queueId: string | null;
};

export type AppUserRecord = {
  id: string;
  authUserId: string;
  role: string;
  isActive: boolean;
};

export type QueueRecord = {
  id: string;
  patient_id: string;
  status: string | null;
  specialty: string | null;
  position: number | null;
  estimated_wait_time: number | null;
  assigned_professional_id: string | null;
  solicitacao_exame_id: string | null;
};

export type LeaveQueueResult = {
  left: boolean;
  queueEntry: {
    id: string;
    status: string;
    specialty: string;
    position: number;
    estimatedWaitTime: number;
    assignedProfessionalId: string;
    solicitacaoExameId: string;
  } | null;
};

export type LeaveQueueSuccessResponse = ApiSuccess<LeaveQueueResult>;
export type ErrorResponse = ApiErrorResponse;

export type LeaveQueueRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  findActiveQueueEntry(params: {
    patientId: string;
    queueId: string | null;
  }): Promise<QueueRecord | null>;
  cancelQueueEntry(queueId: string): Promise<QueueRecord>;
};

export type LeaveQueueCommand = {
  requestId: string;
  input: LeaveQueueInput;
  authenticatedUser: AuthenticatedUser;
};
