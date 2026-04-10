import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';

export type AcceptQueueEntryInput = {
  queueId: string;
};

export type AppUserRecord = {
  id: string;
  authUserId: string;
  fullName: string;
  role: string;
  isActive: boolean;
};

export type ProfessionalDutyRecord = {
  appUserId: string;
  profileId: string;
  fullName: string;
  specialty: string;
  isOnDuty: boolean;
  publicStatus: string;
  source: 'professional_profiles';
};

export type AcceptQueueEntryTransactionRecord = {
  queue_id: string;
  queue_status: string;
  queue_assigned_professional_id: string;
  queue_patient_id: string;
  queue_patient_name: string;
  queue_specialty: string;
  queue_position: number;
  queue_estimated_wait_time: number;
  queue_solicitacao_exame_id: string;
  consulta_id: string;
  consulta_status: string;
  consulta_tipo: string;
  consulta_datetime: string;
  consulta_professional_id: string;
  consulta_professional_user_id: string;
  consulta_professional_name: string;
};

export type AcceptQueueEntryResult = {
  queue: {
    id: string;
    status: string;
    assignedProfessionalId: string;
    patientId: string;
    patientName: string;
    specialty: string;
    position: number;
    estimatedWaitTime: number;
    solicitacaoExameId: string;
  };
  consulta: {
    id: string;
    status: string;
    tipoConsulta: string;
    datetime: string;
    professionalId: string;
    professionalUserId: string;
    professionalName: string;
  };
};

export type AcceptQueueEntrySuccessResponse = ApiSuccess<AcceptQueueEntryResult>;

export type ErrorResponse = ApiErrorResponse;

export type AcceptQueueEntryRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  findProfessionalDutyContextByUserId(appUserId: string): Promise<ProfessionalDutyRecord | null>;
  acceptQueueEntry(params: {
    queueId: string;
    professionalAppUserId: string;
    professionalProfileId: string;
  }): Promise<AcceptQueueEntryTransactionRecord>;
};

export type AcceptQueueEntryCommand = {
  requestId: string;
  queueId: string;
  authenticatedUser: AuthenticatedUser;
};
