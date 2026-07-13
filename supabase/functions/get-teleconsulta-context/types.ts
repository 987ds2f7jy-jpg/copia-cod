import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';
import type { AppUserRecord } from '../_shared/appUsers.ts';
import type {
  ConsultationRow,
  ConsultaEvaluationRow,
  PatientSummaryRow,
  ProfessionalIdentityRow,
  ProntuarioRow,
} from '../_shared/teleconsulta.ts';
import type { ConsultationConsentState } from '../_shared/consultation-consent.ts';

export type TeleconsultaPaymentContext = {
  ownerType: 'appointment' | 'queue' | 'solicitacao_exame';
  ownerId: string;
  paymentRequired: boolean;
  paymentStatus: string;
  currentPaymentChargeId: string;
  grossPrice: number;
  platformFeePercent: number;
  platformFeeAmount: number;
  professionalNetAmount: number;
};

export type AppointmentPaymentRecord = {
  id: string;
  payment_required: boolean | null;
  payment_status: string | null;
  current_payment_charge_id: string | null;
  gross_price: number | null;
  platform_fee_percent: number | null;
  platform_fee_amount: number | null;
  professional_net_amount: number | null;
};

export type GetTeleconsultaContextInput = {
  consultationId: string | null;
  patientId: string | null;
  patientIds: string[];
  historyLimit: number;
  excludeConsultationId: string | null;
};

export type TeleconsultaParticipantContext = {
  appUserId: string;
  role: 'patient' | 'professional';
  isParticipant: boolean;
  professionalProfileId: string | null;
  canStartSession: boolean;
  canFinishSession: boolean;
  canUpsertProntuario: boolean;
  canSubmitEvaluation: boolean;
};

export type TeleconsultaContextResult = {
  consultation: ReturnType<typeof import('../_shared/teleconsulta.ts').mapConsultationRecord> | null;
  participant: TeleconsultaParticipantContext | null;
  currentProntuario: ReturnType<typeof import('../_shared/teleconsulta.ts').mapProntuarioRecord> | null;
  recentProntuarios: Array<ReturnType<typeof import('../_shared/teleconsulta.ts').mapProntuarioRecord>>;
  currentEvaluation: ReturnType<typeof import('../_shared/teleconsulta.ts').mapConsultaEvaluationRecord> | null;
  patientSummary: ReturnType<typeof import('../_shared/teleconsulta.ts').mapPatientSummaryRecord> | null;
  patientSummaries: Array<ReturnType<typeof import('../_shared/teleconsulta.ts').mapPatientSummaryRecord>>;
  payment: TeleconsultaPaymentContext | null;
  consents: ConsultationConsentState | null;
};

export type GetTeleconsultaContextSuccessResponse = ApiSuccess<TeleconsultaContextResult>;
export type ErrorResponse = ApiErrorResponse;

export type GetTeleconsultaContextRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  findConsultationById(consultationId: string): Promise<ConsultationRow | null>;
  findProfessionalIdentityByAppUserId(appUserId: string): Promise<ProfessionalIdentityRow | null>;
  listAuthorizedPatientIdsForProfessional(params: {
    appUserId: string;
    professionalProfileIds: string[];
    patientIds: string[];
  }): Promise<string[]>;
  findPaymentOwnerByConsultationId(consultationId: string): Promise<AppointmentPaymentRecord | null>;
  closeExpiredConsultation(params: {
    consultationId: string;
    finishedAt: string;
  }): Promise<void>;
  completeAppointmentsByConsultationId(consultationId: string): Promise<void>;
  completeQueueEntriesByConsultation(consultation: ConsultationRow): Promise<void>;
  findProntuarioByConsultationId(consultationId: string): Promise<ProntuarioRow | null>;
  listPatientProntuarios(params: {
    patientId: string;
    historyLimit: number;
    excludeConsultationId?: string | null;
  }): Promise<ProntuarioRow[]>;
  findConsultaEvaluation(params: {
    consultationId: string;
    patientId: string;
  }): Promise<ConsultaEvaluationRow | null>;
  findPatientById(patientId: string): Promise<PatientSummaryRow | null>;
  listPatientsByIds(patientIds: string[]): Promise<PatientSummaryRow[]>;
  listLatestProntuariosByPatientIds(patientIds: string[]): Promise<ProntuarioRow[]>;
  loadConsultationConsentState(params: {
    consultationId: string;
    patientUserId: string;
  }): Promise<ConsultationConsentState>;
};

export type GetTeleconsultaContextCommand = {
  requestId: string;
  input: GetTeleconsultaContextInput;
  authenticatedUser: AuthenticatedUser;
};
