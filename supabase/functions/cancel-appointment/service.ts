import { AppError } from '../_shared/errors.ts';
import type {
  CancelAppointmentCommand,
  CancelAppointmentRepository,
  CancelAppointmentResult,
} from './types.ts';

const CANCELLED_STATUSES = new Set(['cancelled', 'CANCELADO']);
const COMPLETED_STATUSES = new Set(['completed', 'CONCLUIDO', 'EXPIRADO']);

function ensureCancelableStatus(status: string) {
  if (CANCELLED_STATUSES.has(status)) {
    throw new AppError({
      status: 409,
      code: 'APPOINTMENT_ALREADY_CANCELLED',
      message: 'Appointment is already cancelled.',
    });
  }

  if (COMPLETED_STATUSES.has(status)) {
    throw new AppError({
      status: 409,
      code: 'APPOINTMENT_NOT_CANCELABLE',
      message: 'Completed appointments cannot be cancelled.',
    });
  }
}

function ensureAuthorizedCancellation({
  appUserId,
  appUserRole,
  appointmentPatientId,
  appointmentProfessionalId,
  professionalIdentityIds,
}: {
  appUserId: string;
  appUserRole: string;
  appointmentPatientId: string;
  appointmentProfessionalId: string | null;
  professionalIdentityIds: string[];
}) {
  if (appUserRole === 'admin') {
    return;
  }

  if (appointmentPatientId === appUserId) {
    return;
  }

  if (
    appUserRole === 'professional'
    && appointmentProfessionalId
    && professionalIdentityIds.includes(appointmentProfessionalId)
  ) {
    return;
  }

  throw new AppError({
    status: 403,
    code: 'APPOINTMENT_CANCEL_FORBIDDEN',
    message: 'Authenticated user cannot cancel this appointment.',
  });
}

export async function cancelAppointment({
  requestId,
  input,
  authenticatedUser,
  repository,
}: {
  repository: CancelAppointmentRepository;
} & CancelAppointmentCommand): Promise<CancelAppointmentResult> {
  const appUser = await repository.findAppUserByAuthUserId(authenticatedUser.authUserId);

  if (!appUser?.id) {
    throw new AppError({
      status: 403,
      code: 'APP_USER_NOT_FOUND',
      message: 'Authenticated user is not linked to app_users.',
    });
  }

  if (appUser.isActive === false) {
    throw new AppError({
      status: 403,
      code: 'ACCOUNT_INACTIVE',
      message: 'Authenticated account is inactive.',
    });
  }

  const appointment = await repository.findAppointmentById(input.appointmentId);

  if (!appointment?.id) {
    throw new AppError({
      status: 404,
      code: 'APPOINTMENT_NOT_FOUND',
      message: 'Appointment not found.',
    });
  }

  ensureCancelableStatus(String(appointment.status || ''));

  const professionalIdentityIds = appUser.role === 'professional'
    ? await repository.listProfessionalIdentityIdsForUser(appUser.id)
    : [];

  ensureAuthorizedCancellation({
    appUserId: appUser.id,
    appUserRole: appUser.role,
    appointmentPatientId: appointment.patient_id,
    appointmentProfessionalId: appointment.professional_id,
    professionalIdentityIds,
  });

  console.info('[cancel-appointment] request:start', {
    requestId,
    appointmentId: appointment.id,
    actorAppUserId: appUser.id,
    actorRole: appUser.role,
  });

  const updatedAppointment = await repository.cancelAppointment({
    appointmentId: appointment.id,
    reason: input.reason,
  });

  console.info('[cancel-appointment] request:success', {
    requestId,
    appointmentId: updatedAppointment.id,
    actorAppUserId: appUser.id,
  });

  return {
    appointment: updatedAppointment,
  };
}
