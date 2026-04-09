import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';
import type { AppUserRecord } from '../_shared/appUsers.ts';

export type CancelAppointmentInput = {
  appointmentId: string;
  reason: string;
};

export type AppointmentRecord = {
  id: string;
  patient_id: string;
  professional_id: string | null;
  status: string | null;
  cancellation_reason: string | null;
  professional_name: string | null;
  specialty: string | null;
  scheduled_datetime: string | null;
  date: string | null;
  time: string | null;
};

export type CancelAppointmentResult = {
  appointment: AppointmentRecord;
};

export type CancelAppointmentSuccessResponse = ApiSuccess<CancelAppointmentResult>;
export type ErrorResponse = ApiErrorResponse;

export type CancelAppointmentRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  findAppointmentById(appointmentId: string): Promise<AppointmentRecord | null>;
  listProfessionalIdentityIdsForUser(userId: string): Promise<string[]>;
  cancelAppointment(params: {
    appointmentId: string;
    reason: string;
  }): Promise<AppointmentRecord>;
};

export type CancelAppointmentCommand = {
  requestId: string;
  input: CancelAppointmentInput;
  authenticatedUser: AuthenticatedUser;
};
