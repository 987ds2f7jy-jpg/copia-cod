import { AppError } from '../_shared/errors.ts';
import type {
  SubmitAppointmentReviewCommand,
  SubmitAppointmentReviewRepository,
  SubmitAppointmentReviewResult,
} from './types.ts';

const COMPLETED_STATUSES = new Set(['completed', 'CONCLUIDO']);

function roundRating(value: number) {
  return Math.round(value * 10) / 10;
}

export async function submitAppointmentReview({
  requestId,
  input,
  authenticatedUser,
  repository,
}: {
  repository: SubmitAppointmentReviewRepository;
} & SubmitAppointmentReviewCommand): Promise<SubmitAppointmentReviewResult> {
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

  if (appUser.role === 'professional') {
    throw new AppError({
      status: 403,
      code: 'PATIENT_ROLE_REQUIRED',
      message: 'Professional accounts cannot review appointments as patients.',
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

  if (appointment.patient_id !== appUser.id) {
    throw new AppError({
      status: 403,
      code: 'REVIEW_FORBIDDEN',
      message: 'Authenticated user does not own this appointment.',
    });
  }

  if (!COMPLETED_STATUSES.has(String(appointment.status || ''))) {
    throw new AppError({
      status: 409,
      code: 'REVIEW_NOT_ALLOWED',
      message: 'Only completed appointments can be reviewed.',
    });
  }

  if (!appointment.professional_id) {
    throw new AppError({
      status: 422,
      code: 'APPOINTMENT_PROFESSIONAL_MISSING',
      message: 'Appointment does not have a professional assigned.',
    });
  }

  const existingReview = await repository.findExistingReview({
    appointmentId: appointment.id,
    patientId: appUser.id,
  });

  if (existingReview?.id) {
    throw new AppError({
      status: 409,
      code: 'REVIEW_ALREADY_EXISTS',
      message: 'This appointment has already been reviewed by the patient.',
    });
  }

  console.info('[submit-appointment-review] request:start', {
    requestId,
    appointmentId: appointment.id,
    patientId: appUser.id,
    professionalId: appointment.professional_id,
  });

  const review = await repository.createReview({
    appointmentId: appointment.id,
    patientId: appUser.id,
    patientName: appUser.fullName || appUser.email || 'Paciente',
    professionalId: appointment.professional_id,
    rating: input.rating,
    comment: input.comment,
  });

  const allReviews = await repository.listReviewsByProfessionalId(appointment.professional_id);
  const totalReviews = allReviews.length;
  const averageRating = totalReviews > 0
    ? roundRating(allReviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / totalReviews)
    : 0;

  await repository.updateProfessionalReviewStats({
    professionalId: appointment.professional_id,
    averageRating,
    totalReviews,
  });

  console.info('[submit-appointment-review] request:success', {
    requestId,
    reviewId: review.id,
    appointmentId: appointment.id,
    professionalId: appointment.professional_id,
    averageRating,
    totalReviews,
  });

  return {
    review,
    reviewStats: {
      averageRating,
      totalReviews,
    },
  };
}
