import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';

export type AcceptAppointmentInput = {
  appointmentId: string;
};

export type AppUserRecord = {
  id: string;
  authUserId: string;
  fullName: string;
  role: string;
  isActive: boolean;
};

export type ProfessionalProfileRecord = {
  appUserId: string;
  profileId: string;
  fullName: string;
  specialty: string;
  source: 'professional_profiles';
};

export type AppointmentAcceptanceWindowRecord = {
  id: string;
  status: string;
  appointmentType: string;
  scheduledDatetime: string | null;
  date: string | null;
  time: string | null;
};

export type PlanCreditUsageRecord = {
  id: string;
  status: string;
  externalSubscriptionScoreId: string | null;
  externalScoreId: string | null;
  requestSnapshot: Record<string, unknown>;
  responseSnapshot: Record<string, unknown>;
};

export type PlanAppointmentAcceptanceContext = {
  appointment: {
    id: string;
    status: string;
    fundingSource: string;
    coverageStatus: string | null;
    paymentRequired: boolean;
    planCreditUsageId: string | null;
    professionalId: string | null;
    professionalName: string;
    specialty: string;
    scheduledDatetime: string | null;
    acceptedAt: string | null;
    consultaId: string | null;
  };
  usage: PlanCreditUsageRecord | null;
};

export type AcceptAppointmentTransactionRecord = {
  appointment_id: string;
  appointment_status: string;
  appointment_accepted_at: string;
  appointment_scheduled_datetime: string;
  appointment_professional_id: string;
  appointment_professional_name: string;
  consulta_id: string;
  consulta_status: string;
  consulta_tipo: string;
  consulta_datetime: string;
};

export type AcceptAppointmentResult = {
  appointment: {
    id: string;
    status: string;
    acceptedAt: string;
    scheduledAt: string;
    professionalId: string;
    professionalName: string;
  };
  consulta: {
    id: string;
    status: string;
    tipoConsulta: string;
    datetime: string;
  };
};

export type AcceptAppointmentSuccessResponse = ApiSuccess<AcceptAppointmentResult>;

export type ErrorResponse = ApiErrorResponse;

export type AcceptAppointmentRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  findActiveProfessionalProfileByUserId(appUserId: string): Promise<ProfessionalProfileRecord | null>;
  findAppointmentAcceptanceWindow(appointmentId: string): Promise<AppointmentAcceptanceWindowRecord | null>;
  findPlanAppointmentAcceptanceContext(appointmentId: string): Promise<PlanAppointmentAcceptanceContext | null>;
  findAcceptedAppointmentResult(params: {
    appointmentId: string;
    professionalProfileId: string;
  }): Promise<AcceptAppointmentTransactionRecord | null>;
  confirmPlanCreditBeforeAcceptance(params: {
    context: PlanAppointmentAcceptanceContext;
  }): Promise<{
    skipped: boolean;
    reason: 'already_used' | 'used_now';
  }>;
  acceptAppointment(params: {
    appointmentId: string;
    professionalAppUserId: string;
    professionalProfileId: string;
  }): Promise<AcceptAppointmentTransactionRecord>;
};

export type AcceptAppointmentCommand = {
  requestId: string;
  appointmentId: string;
  authenticatedUser: AuthenticatedUser;
};
