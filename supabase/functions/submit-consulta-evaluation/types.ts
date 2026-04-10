import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';
import type { AppUserRecord } from '../_shared/appUsers.ts';
import type {
  ConsultationRow,
  ConsultaEvaluationRow,
} from '../_shared/teleconsulta.ts';

export type SubmitConsultaEvaluationInput = {
  consultationId: string;
  rating: number;
  comment: string;
};

export type AppointmentLinkRecord = {
  id: string;
  patient_id: string;
  professional_id: string | null;
  status: string | null;
};

export type ReviewRecord = {
  id: string;
  appointment_id: string | null;
  patient_id: string | null;
  patient_name: string | null;
  professional_id: string;
  rating: number | null;
  comment: string | null;
  created_date: string;
  updated_at: string;
};

export type SubmitConsultaEvaluationResult = {
  evaluation: ReturnType<typeof import('../_shared/teleconsulta.ts').mapConsultaEvaluationRecord>;
  reviewSynced: boolean;
  reviewStats: {
    averageRating: number;
    totalReviews: number;
  } | null;
};

export type SubmitConsultaEvaluationSuccessResponse = ApiSuccess<SubmitConsultaEvaluationResult>;
export type ErrorResponse = ApiErrorResponse;

export type SubmitConsultaEvaluationRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  findConsultationById(consultationId: string): Promise<ConsultationRow | null>;
  findConsultaEvaluation(params: {
    consultationId: string;
    patientId: string;
  }): Promise<ConsultaEvaluationRow | null>;
  createConsultaEvaluation(params: {
    consultationId: string;
    patientId: string;
    professionalId: string;
    rating: number;
    comment: string;
  }): Promise<ConsultaEvaluationRow>;
  findAppointmentByConsultationId(consultationId: string): Promise<AppointmentLinkRecord | null>;
  updateAppointmentStatus(params: {
    appointmentId: string;
    status: string;
  }): Promise<AppointmentLinkRecord>;
  findExistingReview(params: {
    appointmentId: string;
    patientId: string;
  }): Promise<ReviewRecord | null>;
  createReview(params: {
    appointmentId: string;
    patientId: string;
    patientName: string;
    professionalId: string;
    rating: number;
    comment: string;
  }): Promise<ReviewRecord>;
  listReviewsByProfessionalId(professionalId: string): Promise<ReviewRecord[]>;
  updateProfessionalReviewStats(params: {
    professionalId: string;
    averageRating: number;
    totalReviews: number;
  }): Promise<void>;
};

export type SubmitConsultaEvaluationCommand = {
  requestId: string;
  input: SubmitConsultaEvaluationInput;
  authenticatedUser: AuthenticatedUser;
};
