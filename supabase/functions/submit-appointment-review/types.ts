import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';
import type { AppUserRecord } from '../_shared/appUsers.ts';

export type SubmitAppointmentReviewInput = {
  appointmentId: string;
  rating: number;
  comment: string;
};

export type AppointmentRecord = {
  id: string;
  patient_id: string;
  professional_id: string | null;
  professional_name: string | null;
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

export type SubmitAppointmentReviewResult = {
  review: ReviewRecord;
  reviewStats: {
    averageRating: number;
    totalReviews: number;
  };
};

export type SubmitAppointmentReviewSuccessResponse = ApiSuccess<SubmitAppointmentReviewResult>;
export type ErrorResponse = ApiErrorResponse;

export type SubmitAppointmentReviewRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  findAppointmentById(appointmentId: string): Promise<AppointmentRecord | null>;
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

export type SubmitAppointmentReviewCommand = {
  requestId: string;
  input: SubmitAppointmentReviewInput;
  authenticatedUser: AuthenticatedUser;
};
