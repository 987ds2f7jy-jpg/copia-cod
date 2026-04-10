import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';
import type { AppUserRecord } from '../_shared/appUsers.ts';
import type {
  ConsultationRow,
  ProfessionalIdentityRow,
  ProntuarioRow,
} from '../_shared/teleconsulta.ts';

export type UpsertProntuarioInput = {
  consultationId: string;
  mode: 'completo' | 'simples';
  motivoConsulta: string;
  historicoRisco: string;
  examesImagem: string;
  exameFisico: string;
  avaliacaoDiagnostico: string;
  recomendacoes: string;
};

export type AppointmentLinkRecord = {
  id: string;
  status: string | null;
};

export type QueueLinkRecord = {
  id: string;
  status: string | null;
};

export type UpsertProntuarioResult = {
  consultation: ReturnType<typeof import('../_shared/teleconsulta.ts').mapConsultationRecord>;
  prontuario: ReturnType<typeof import('../_shared/teleconsulta.ts').mapProntuarioRecord>;
  created: boolean;
};

export type UpsertProntuarioSuccessResponse = ApiSuccess<UpsertProntuarioResult>;
export type ErrorResponse = ApiErrorResponse;

export type UpsertProntuarioRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  findConsultationById(consultationId: string): Promise<ConsultationRow | null>;
  findProfessionalIdentityByAppUserId(appUserId: string): Promise<ProfessionalIdentityRow | null>;
  updateConsultationSession(params: {
    consultationId: string;
    status: string;
    startedAt: string;
    roomId: string;
    roomToken: string;
  }): Promise<ConsultationRow>;
  findProntuarioByConsultationId(consultationId: string): Promise<ProntuarioRow | null>;
  createProntuario(params: {
    consultationId: string;
    patientId: string;
    professionalId: string;
    mode: string;
    motivoConsulta: string;
    historicoRisco: string;
    examesImagem: string;
    exameFisico: string;
    avaliacaoDiagnostico: string;
    recomendacoes: string;
  }): Promise<ProntuarioRow>;
  updateProntuario(params: {
    prontuarioId: string;
    mode: string;
    motivoConsulta: string;
    historicoRisco: string;
    examesImagem: string;
    exameFisico: string;
    avaliacaoDiagnostico: string;
    recomendacoes: string;
  }): Promise<ProntuarioRow>;
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

export type UpsertProntuarioCommand = {
  requestId: string;
  input: UpsertProntuarioInput;
  authenticatedUser: AuthenticatedUser;
};
