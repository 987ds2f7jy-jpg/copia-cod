import { AppError } from '../_shared/errors.ts';
import {
  assertPaymentReadyForOperation,
  mapAppointmentPaymentGuardSnapshot,
} from '../_shared/payments/payment-guards.ts';
import {
  buildConsultaRoomPayload,
  isConsultaClosed,
  mapConsultationRecord,
  resolveConsultaParticipantRole,
} from '../_shared/teleconsulta.ts';
import type {
  StartConsultaSessionCommand,
  StartConsultaSessionRepository,
  StartConsultaSessionResult,
} from './types.ts';

const APPOINTMENT_FINAL_STATUSES = new Set(['completed', 'cancelled', 'CANCELADO', 'CONCLUIDO']);
const QUEUE_FINAL_STATUSES = new Set(['completed', 'cancelled']);

export async function startConsultaSession({
  requestId,
  input,
  authenticatedUser,
  repository,
}: {
  repository: StartConsultaSessionRepository;
} & StartConsultaSessionCommand): Promise<StartConsultaSessionResult> {
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

  const consultation = await repository.findConsultationById(input.consultationId);

  if (!consultation?.id) {
    throw new AppError({
      status: 404,
      code: 'CONSULTATION_NOT_FOUND',
      message: 'Telemedicine consultation not found.',
    });
  }

  if (isConsultaClosed(consultation.status)) {
    throw new AppError({
      status: 409,
      code: 'CONSULTATION_ALREADY_CLOSED',
      message: 'Closed consultations cannot be started again.',
    });
  }

  const professionalIdentity = appUser.role === 'professional'
    ? await repository.findProfessionalIdentityByAppUserId(appUser.id)
    : null;

  const participantRole = resolveConsultaParticipantRole({
    consulta: consultation,
    appUserId: appUser.id,
    professionalProfileId: professionalIdentity?.profileId || null,
    professionalProfileIds: professionalIdentity?.profileIds || [],
  });

  if (!participantRole) {
    throw new AppError({
      status: 403,
      code: 'CONSULTATION_ACCESS_FORBIDDEN',
      message: 'Authenticated user does not belong to this consultation.',
    });
  }

  if (participantRole !== 'professional') {
    throw new AppError({
      status: 403,
      code: 'CONSULTATION_START_FORBIDDEN',
      message: 'Apenas o profissional pode iniciar a sessao da consulta.',
    });
  }

  await repository.requireTelemedicineConsent({
    consultationId: consultation.id,
    patientUserId: consultation.paciente_id,
  });

  const [appointment, queue] = await Promise.all([
    repository.findAppointmentByConsultationId(consultation.id),
    repository.findQueueEntryByConsultation(consultation),
  ]);

  assertPaymentReadyForOperation({
    owner: appointment?.id ? mapAppointmentPaymentGuardSnapshot(appointment) : null,
    operation: 'start_consulta_session',
    fallbackGrossPrice: consultation.preco,
  });

  const startedAt = consultation.inicio_at || new Date().toISOString();
  const roomPayload = buildConsultaRoomPayload(consultation);
  const requiresConsultationUpdate =
    consultation.status !== 'em_atendimento' ||
    !consultation.inicio_at ||
    !consultation.sala_id ||
    !consultation.token_sala;

  console.info('[start-consulta-session] request:start', {
    requestId,
    consultationId: consultation.id,
    participantRole,
    appUserId: appUser.id,
  });

  const updatedConsultation = requiresConsultationUpdate
    ? await repository.updateConsultationSession({
      consultationId: consultation.id,
      status: 'em_atendimento',
      startedAt,
      roomId: roomPayload.roomId,
      roomToken: roomPayload.roomToken,
    })
    : consultation;

  const nextAppointment = appointment?.id && !APPOINTMENT_FINAL_STATUSES.has(String(appointment.status || ''))
    ? await repository.updateAppointmentStatus({
      appointmentId: appointment.id,
      status: 'in_progress',
    })
    : appointment;

  const nextQueue = queue?.id && !QUEUE_FINAL_STATUSES.has(String(queue.status || ''))
    ? await repository.updateQueueStatus({
      queueId: queue.id,
      status: 'em_atendimento',
    })
    : queue;

  console.info('[start-consulta-session] request:success', {
    requestId,
    consultationId: updatedConsultation.id,
    appointmentStatus: nextAppointment?.status || null,
    queueStatus: nextQueue?.status || null,
  });

  return {
    consultation: mapConsultationRecord(updatedConsultation),
    participantRole,
    started: requiresConsultationUpdate,
    appointmentStatus: nextAppointment?.status || null,
    queueStatus: nextQueue?.status || null,
  };
}
