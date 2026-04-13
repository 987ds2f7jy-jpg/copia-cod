import { AppError } from '../_shared/errors.ts';
import {
  mapConsultaEvaluationRecord,
  resolveConsultaParticipantRole,
} from '../_shared/teleconsulta.ts';
import type {
  SubmitConsultaEvaluationCommand,
  SubmitConsultaEvaluationRepository,
  SubmitConsultaEvaluationResult,
} from './types.ts';

const APPOINTMENT_COMPLETED_STATUSES = new Set(['completed', 'CONCLUIDO']);
const APPOINTMENT_CANCELLED_STATUSES = new Set(['cancelled', 'CANCELADO']);

function roundRating(value: number) {
  return Math.round(value * 10) / 10;
}

export async function submitConsultaEvaluation({
  requestId,
  input,
  authenticatedUser,
  repository,
}: {
  repository: SubmitConsultaEvaluationRepository;
} & SubmitConsultaEvaluationCommand): Promise<SubmitConsultaEvaluationResult> {
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

  if (appUser.role !== 'patient') {
    throw new AppError({
      status: 403,
      code: 'PATIENT_ROLE_REQUIRED',
      message: 'Only patients can submit consultation evaluations.',
    });
  }

  const consultation = await repository.findConsultationById(input.consultationId);

  if (!consultation?.id) {
    throw new AppError({
      status: 404,
      code: 'CONSULTATION_NOT_FOUND',
      message: 'Telemedicine consultation not found.',
    });
  }

  const participantRole = resolveConsultaParticipantRole({
    consulta: consultation,
    appUserId: appUser.id,
    professionalProfileId: null,
  });

  if (participantRole !== 'patient') {
    throw new AppError({
      status: 403,
      code: 'CONSULTATION_ACCESS_FORBIDDEN',
      message: 'Authenticated patient does not belong to this consultation.',
    });
  }

  if (consultation.status !== 'finalizada') {
    throw new AppError({
      status: 409,
      code: 'CONSULTATION_NOT_FINISHED',
      message: 'Only finished consultations can be evaluated.',
    });
  }

  const existingEvaluation = await repository.findConsultaEvaluation({
    consultationId: consultation.id,
    patientId: appUser.id,
  });

  if (existingEvaluation?.id) {
    throw new AppError({
      status: 409,
      code: 'CONSULTA_EVALUATION_ALREADY_EXISTS',
      message: 'This consultation has already been evaluated by the patient.',
    });
  }

  console.info('[submit-consulta-evaluation] request:start', {
    requestId,
    consultationId: consultation.id,
    patientId: appUser.id,
    professionalId: consultation.profissional_id,
  });

  let appointment = null;

  try {
    appointment = await repository.findAppointmentByConsultationId(consultation.id);
  } catch (error) {
    console.warn('[submit-consulta-evaluation] appointment-lookup-failed', {
      requestId,
      consultationId: consultation.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (appointment?.id && appointment.patient_id !== appUser.id) {
    throw new AppError({
      status: 409,
      code: 'APPOINTMENT_PATIENT_MISMATCH',
      message: 'Related appointment does not belong to the authenticated patient.',
    });
  }

  const evaluation = await repository.createConsultaEvaluation({
    consultationId: consultation.id,
    patientId: appUser.id,
    professionalId: consultation.profissional_id,
    rating: input.rating,
    comment: input.comment,
  });

  let reviewSynced = false;
  let reviewStats: SubmitConsultaEvaluationResult['reviewStats'] = null;

  if (appointment?.id) {
    try {
      if (!APPOINTMENT_COMPLETED_STATUSES.has(String(appointment.status || '')) && !APPOINTMENT_CANCELLED_STATUSES.has(String(appointment.status || ''))) {
        await repository.updateAppointmentStatus({
          appointmentId: appointment.id,
          status: 'completed',
        });
      }

      if (appointment.professional_id) {
        const existingReview = await repository.findExistingReview({
          appointmentId: appointment.id,
          patientId: appUser.id,
        });

        if (!existingReview?.id) {
          await repository.createReview({
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

          reviewSynced = true;
          reviewStats = {
            averageRating,
            totalReviews,
          };
        }
      }
    } catch (error) {
      console.warn('[submit-consulta-evaluation] review-sync-failed', {
        requestId,
        consultationId: consultation.id,
        appointmentId: appointment.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.info('[submit-consulta-evaluation] request:success', {
    requestId,
    consultationId: consultation.id,
    evaluationId: evaluation.id,
    reviewSynced,
  });

  return {
    evaluation: mapConsultaEvaluationRecord(evaluation),
    reviewSynced,
    reviewStats,
  };
}
