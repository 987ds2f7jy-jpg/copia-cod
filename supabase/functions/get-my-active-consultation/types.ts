import type { AppUser } from '../_shared/professional.ts';
import type { ConsultationRow, ProfessionalIdentityRow } from '../_shared/teleconsulta.ts';

export type ActiveConsultationRow = ConsultationRow & {
  created_date: string | null;
};

export type GetMyActiveConsultationRepository = {
  findProfessionalIdentityByAppUserId(appUserId: string): Promise<ProfessionalIdentityRow | null>;
  listActiveConsultationsForPatient(appUserId: string): Promise<ActiveConsultationRow[]>;
  listActiveConsultationsForProfessional(params: {
    appUserId: string;
    professionalProfileIds: string[];
  }): Promise<ActiveConsultationRow[]>;
  closeExpiredConsultation(params: {
    consultationId: string;
    finishedAt: string;
  }): Promise<void>;
  completeAppointmentsByConsultationId(consultationId: string): Promise<void>;
  completeQueueEntriesByConsultation(consultation: ActiveConsultationRow): Promise<void>;
};

export type GetMyActiveConsultationResult = {
  hasActiveConsultation: boolean;
  consultation: ReturnType<typeof import('../_shared/teleconsulta.ts').mapConsultationRecord> | null;
  participantRole: 'patient' | 'professional' | null;
  resumeUrl: string | null;
  roomReady: boolean;
  needsProfessionalStart: boolean;
  counterpartName: string | null;
};

export type GetMyActiveConsultationCommand = {
  requestId: string;
  appUser: AppUser;
  repository: GetMyActiveConsultationRepository;
};
