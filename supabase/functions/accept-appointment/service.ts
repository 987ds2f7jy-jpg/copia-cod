import { AppError } from '../_shared/errors.ts';
import type {
  AcceptAppointmentCommand,
  AcceptAppointmentRepository,
  AcceptAppointmentResult,
} from './types.ts';

export async function acceptAppointment({
  requestId,
  appointmentId,
  authenticatedUser,
  repository,
}: {
  repository: AcceptAppointmentRepository;
} & AcceptAppointmentCommand): Promise<AcceptAppointmentResult> {
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

  if (appUser.role !== 'professional') {
    throw new AppError({
      status: 403,
      code: 'PROFESSIONAL_ROLE_REQUIRED',
      message: 'Only professionals can accept appointments.',
    });
  }

  const professional = await repository.findActiveProfessionalProfileByUserId(appUser.id);

  if (!professional?.profileId) {
    throw new AppError({
      status: 403,
      code: 'PROFESSIONAL_PROFILE_NOT_FOUND',
      message: 'No active professional profile was found for this user.',
    });
  }

  console.info('[accept-appointment] request:start', {
    requestId,
    appointmentId,
    appUserId: appUser.id,
    profileId: professional.profileId,
  });

  const row = await repository.acceptAppointment({
    appointmentId,
    professionalAppUserId: professional.appUserId,
    professionalProfileId: professional.profileId,
  });

  console.info('[accept-appointment] request:success', {
    requestId,
    appointmentId: row.appointment_id,
    consultaId: row.consulta_id,
    professionalId: row.appointment_professional_id,
  });

  return {
    appointment: {
      id: row.appointment_id,
      status: row.appointment_status,
      acceptedAt: row.appointment_accepted_at,
      scheduledAt: row.appointment_scheduled_datetime,
      professionalId: row.appointment_professional_id,
      professionalName: row.appointment_professional_name,
    },
    consulta: {
      id: row.consulta_id,
      status: row.consulta_status,
      tipoConsulta: row.consulta_tipo,
      datetime: row.consulta_datetime,
    },
  };
}
