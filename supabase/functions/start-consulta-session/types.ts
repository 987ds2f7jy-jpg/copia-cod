import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';
import type { AppUserRecord } from '../_shared/appUsers.ts';
import type {
  ConsultationRow,
  ProfessionalIdentityRow,
} from '../_shared/teleconsulta.ts';

export type StartConsultaSessionInput = {
  consultationId: string;
};

export type ConsultationLifecycleRecord = ConsultationRow;

export type AppointmentLinkRecord = {
  id: string;
  status: string | null;
};

export type QueueLinkRecord = {
  id: string;
  status: string | null;
};

export type StartConsultaSessionResult = {
  consultation: ReturnType<typeof import('../_shared/teleconsulta.ts').mapConsultationRecord>;
  participantRole: 'patient' | 'professional';
  started: boolean;
  appointmentStatus: string | null;
  queueStatus: string | null;
};

export type StartConsultaSessionSuccessResponse = ApiSuccess<StartConsultaSessionResult>;
export type ErrorResponse = ApiErrorResponse;

export type StartConsultaSessionRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  findConsultationById(consultationId: string): Promise<ConsultationRow | null>;
  findProfessionalIdentityByAppUserId(appUserId: string): Promise<ProfessionalIdentityRow | null>;
  updateConsultationSession(params: {
    consultationId: string;
    status: string;
    startedAt: string;
    roomId: string;
    roomToken: string;
  }): Promise<ConsultationLifecycleRecord>;
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

export type StartConsultaSessionCommand = {
  requestId: string;
  input: StartConsultaSessionInput;
  authenticatedUser: AuthenticatedUser;
};
