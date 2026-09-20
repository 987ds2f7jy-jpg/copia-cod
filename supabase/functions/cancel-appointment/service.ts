import { AppError } from '../_shared/errors.ts';
import {
  logInternalNotificationFailure,
  notifyInternalBestEffort,
  type InternalNotificationNotifier,
} from '../_shared/notifications/notify-best-effort.ts';
import { logTechnicalEvent } from '../_shared/observability.ts';
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
  notificationService,
}: {
  repository: CancelAppointmentRepository;
  notificationService?: InternalNotificationNotifier;
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

  const cancelledByPatient = appointment.patient_id === appUser.id;
  const cancelledByProfessional = appUser.role === 'professional'
    && Boolean(appointment.professional_id)
    && professionalIdentityIds.includes(String(appointment.professional_id));

  logTechnicalEvent('info', {
    functionName: 'cancel-appointment',
    requestId,
    operation: 'appointment.cancel',
    actorId: appUser.id,
    actorRole: appUser.role,
    resourceType: 'appointment',
    resourceId: appointment.id,
    status: 'started',
  });

  const updatedAppointment = await repository.cancelAppointment({
    appointmentId: appointment.id,
    reason: input.reason,
  });

  logTechnicalEvent('info', {
    functionName: 'cancel-appointment',
    requestId,
    operation: 'appointment.cancel',
    actorId: appUser.id,
    actorRole: appUser.role,
    resourceType: 'appointment',
    resourceId: updatedAppointment.id,
    status: 'succeeded',
  });

  if (notificationService && (cancelledByPatient || cancelledByProfessional)) {
    let recipientUserId: string | null = cancelledByProfessional
      ? updatedAppointment.patient_id
      : null;
    const recipientRole = cancelledByProfessional ? 'patient' : 'professional';

    if (cancelledByPatient && updatedAppointment.professional_id) {
      try {
        recipientUserId = await repository.findProfessionalAppUserIdByProfileId(
          updatedAppointment.professional_id,
        );

        if (!recipientUserId) {
          logInternalNotificationFailure({
            functionName: 'cancel-appointment',
            requestId,
            typeKey: 'appointment.cancelled',
            recipientUserId: null,
            relatedEntityType: 'appointment',
            relatedEntityId: updatedAppointment.id,
            deduplicationKey: `appointment:${updatedAppointment.id}:cancelled:professional:unresolved`,
          }, new Error('Professional profile does not have an app user id.'));
        }
      } catch (error) {
        logInternalNotificationFailure({
          functionName: 'cancel-appointment',
          requestId,
          typeKey: 'appointment.cancelled',
          recipientUserId: null,
          relatedEntityType: 'appointment',
          relatedEntityId: updatedAppointment.id,
          deduplicationKey: `appointment:${updatedAppointment.id}:cancelled:professional:unresolved`,
        }, error);
      }
    }

    if (recipientUserId) {
      await notifyInternalBestEffort({
        notificationService,
        functionName: 'cancel-appointment',
        requestId,
        input: {
          recipientUserId,
          typeKey: 'appointment.cancelled',
          relatedEntityType: 'appointment',
          relatedEntityId: updatedAppointment.id,
          deduplicationKey: `appointment:${updatedAppointment.id}:cancelled:${recipientRole}:${recipientUserId}`,
        },
      });
    }
  }

  return {
    appointment: updatedAppointment,
  };
}
