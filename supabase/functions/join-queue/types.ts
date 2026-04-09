import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';

export type JoinQueueInput = {
  specialty: string;
  symptoms: string;
  priorityLevel: string;
  solicitacaoExameId: string;
};

export type AppUserRecord = {
  id: string;
  authUserId: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
};

export type QueueRecord = {
  id: string;
  patient_id: string;
  patient_name: string | null;
  patient_email: string | null;
  specialty: string | null;
  symptoms: string | null;
  priority_level: string | null;
  status: string | null;
  position: number | null;
  estimated_wait_time: number | null;
  assigned_professional_id: string | null;
  solicitacao_exame_id: string | null;
};

export type PlantaoConsultaRecord = {
  id: string;
  status: string | null;
  tipo_consulta: string;
};

export type PublicProfileRecord = {
  id: string;
  specialty: string;
  status: string;
  isOnDuty: boolean;
};

export type JoinQueueResult = {
  queueEntry: {
    id: string;
    status: string;
    specialty: string;
    position: number;
    estimatedWaitTime: number;
    assignedProfessionalId: string;
    solicitacaoExameId: string;
  };
  reusedExisting: boolean;
};

export type JoinQueueSuccessResponse = ApiSuccess<JoinQueueResult>;
export type ErrorResponse = ApiErrorResponse;

export type JoinQueueRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  findActivePlantaoConsultaByPatientId(patientId: string): Promise<PlantaoConsultaRecord | null>;
  findCurrentActiveQueueEntry(patientId: string): Promise<QueueRecord | null>;
  listOnDutyPublicProfiles(): Promise<PublicProfileRecord[]>;
  countWaitingQueueBySpecialty(specialty: string): Promise<number>;
  createQueueEntry(params: {
    patientId: string;
    patientName: string;
    patientEmail: string;
    specialty: string;
    symptoms: string;
    priorityLevel: string;
    position: number;
    estimatedWaitTime: number;
    solicitacaoExameId: string;
  }): Promise<QueueRecord>;
};

export type JoinQueueCommand = {
  requestId: string;
  input: JoinQueueInput;
  authenticatedUser: AuthenticatedUser;
};
