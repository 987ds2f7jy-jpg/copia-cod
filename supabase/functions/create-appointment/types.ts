import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';

export type CreateAppointmentInput = {
  professionalProfileId: string | null;
  specialty: string;
  date: string;
  time: string;
  symptoms: string;
  priority: boolean;
};

export type AppUserRecord = {
  id: string;
  authUserId: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
};

export type ProfessionalTargetRecord = {
  profileId: string;
  appUserId: string | null;
  fullName: string;
  specialty: string;
  status: string;
  priceStandard: number;
  pricePriority: number;
  availableHours: string[];
  source: 'professional_profiles' | 'professionals';
};

export type AvailabilitySlotRecord = {
  weekday: number;
  timeSlot: string;
};

export type AppointmentRecord = {
  id: string;
  patient_id: string;
  patient_name: string | null;
  patient_email: string | null;
  professional_id: string | null;
  professional_name: string | null;
  specialty: string | null;
  appointment_type: string | null;
  scheduled_datetime: string | null;
  date: string | null;
  time: string | null;
  status: string | null;
  price: number | null;
  symptoms: string | null;
  accepted_at: string | null;
  consulta_id: string | null;
};

export type CreateAppointmentResult = {
  appointment: {
    id: string;
    status: string;
    appointmentType: string;
    scheduledDatetime: string;
    date: string;
    time: string;
    specialty: string;
    professionalId: string | null;
    professionalName: string;
    price: number;
  };
};

export type CreateAppointmentSuccessResponse = ApiSuccess<CreateAppointmentResult>;
export type ErrorResponse = ApiErrorResponse;

export type CreateAppointmentRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  findProfessionalTargetById(profileId: string): Promise<ProfessionalTargetRecord | null>;
  listAvailabilitySlots(profileId: string): Promise<AvailabilitySlotRecord[]>;
  hasActiveAppointmentConflict(params: {
    professionalId: string;
    scheduledDatetime: string;
  }): Promise<boolean>;
  createAppointment(params: {
    patientId: string;
    patientName: string;
    patientEmail: string;
    professionalId: string | null;
    professionalName: string;
    specialty: string;
    appointmentType: string;
    scheduledDatetime: string;
    date: string;
    time: string;
    status: string;
    price: number;
    symptoms: string;
  }): Promise<AppointmentRecord>;
};

export type CreateAppointmentCommand = {
  requestId: string;
  input: CreateAppointmentInput;
  authenticatedUser: AuthenticatedUser;
};
