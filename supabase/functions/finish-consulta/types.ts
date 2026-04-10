import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';
import type { AppUserRecord } from '../_shared/appUsers.ts';
import type {
  ConsultationRow,
  ProfessionalIdentityRow,
  ProntuarioRow,
} from '../_shared/teleconsulta.ts';

export type FinishConsultaInput = {
  consultationId: string;
};

export type AppointmentLinkRecord = {
  id: string;
  status: string | null;
};

export type QueueLinkRecord = {
  id: string;
  status: string | null;
};

export type FinishConsultaResult = {
  consultation: ReturnType<typeof import('../_shared/teleconsulta.ts').mapConsultationRecord>;
  appointmentStatus: string | null;
  queueStatus: string | null;
  evaluationRequired: boolean;
};

export type FinishConsultaSuccessResponse = ApiSuccess<FinishConsultaResult>;
export type ErrorResponse = ApiErrorResponse;

export type FinishConsultaRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  findConsultationById(consultationId: string): Promise<ConsultationRow | null>;
  findProfessionalIdentityByAppUserId(appUserId: string): Promise<ProfessionalIdentityRow | null>;
  findProntuarioByConsultationId(consultationId: string): Promise<ProntuarioRow | null>;
  updateConsultationFinish(params: {
    consultationId: string;
    status: string;
    startedAt: string;
    finishedAt: string;
    roomId: string;
    roomToken: string;
  }): Promise<ConsultationRow>;
  findAppointmentByConsultationId(consultationId: string): Promise<AppointmentLinkRecord | null>;
  updateAppointmentStatus(params: {
    appointmentId: string;
    status: string;
  }): Promise<AppointmentLinkRecord>;
  findQueueEntryByConsultation(consultation: ConsultationRow): Promise<QueueLinkRecord | null>;
  updateQueueStatus(params: {
    queueId: string;
    status: string;
  }): Promise<QueueLinkRecord>;
};

export type FinishConsultaCommand = {
  requestId: string;
  input: FinishConsultaInput;
  authenticatedUser: AuthenticatedUser;
};
