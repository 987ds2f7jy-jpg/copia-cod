import { AppError } from '../_shared/errors.ts';
import {
  buildConsultaRoomPayload,
  mapConsultationRecord,
  resolveConsultaParticipantRole,
} from '../_shared/teleconsulta.ts';
import type {
  FinishConsultaCommand,
  FinishConsultaRepository,
  FinishConsultaResult,
} from './types.ts';

const APPOINTMENT_COMPLETED_STATUSES = new Set(['completed', 'CONCLUIDO']);
const APPOINTMENT_CANCELLED_STATUSES = new Set(['cancelled', 'CANCELADO']);
const QUEUE_FINAL_STATUSES = new Set(['completed', 'cancelled']);

function assertProntuarioReady(prontuario: Awaited<ReturnType<FinishConsultaRepository['findProntuarioByConsultationId']>>) {
  if (!prontuario?.id) {
    throw new AppError({
      status: 409,
      code: 'PRONTUARIO_REQUIRED',
      message: 'Preencha e salve o prontuario antes de finalizar a consulta.',
    });
  }

  if (!String(prontuario.motivo_consulta || '').trim() || !String(prontuario.recomendacoes || '').trim()) {
    throw new AppError({
      status: 409,
      code: 'PRONTUARIO_REQUIRED_FIELDS_MISSING',
      message: 'O prontuario precisa conter ao menos motivo da consulta e recomendacoes antes da finalizacao.',
    });
  }
}

export async function finishConsulta({
  requestId,
  input,
  authenticatedUser,
  repository,
}: {
  repository: FinishConsultaRepository;
} & FinishConsultaCommand): Promise<FinishConsultaResult> {
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
      message: 'Only professionals can finish consultations.',
    });
  }

  const [consultation, professionalIdentity] = await Promise.all([
    repository.findConsultationById(input.consultationId),
    repository.findProfessionalIdentityByAppUserId(appUser.id),
  ]);

  if (!consultation?.id) {
    throw new AppError({
      status: 404,
      code: 'CONSULTATION_NOT_FOUND',
      message: 'Telemedicine consultation not found.',
    });
  }

  if (consultation.status === 'cancelada') {
    throw new AppError({
      status: 409,
      code: 'CONSULTATION_CANCELLED',
      message: 'Cancelled consultations cannot be finished.',
    });
  }

  const participantRole = resolveConsultaParticipantRole({
    consulta: consultation,
    appUserId: appUser.id,
    professionalProfileId: professionalIdentity?.profileId || null,
    professionalProfileIds: professionalIdentity?.profileIds || [],
  });

  if (participantRole !== 'professional') {
    throw new AppError({
      status: 403,
      code: 'CONSULTATION_ACCESS_FORBIDDEN',
      message: 'Authenticated professional does not belong to this consultation.',
    });
  }

  const prontuario = await repository.findProntuarioByConsultationId(consultation.id);
  assertProntuarioReady(prontuario);

  console.info('[finish-consulta] request:start', {
    requestId,
    consultationId: consultation.id,
    professionalId: consultation.profissional_id,
  });

  const startedAt = consultation.inicio_at || new Date().toISOString();
  const finishedAt = consultation.fim_at || new Date().toISOString();
  const roomPayload = buildConsultaRoomPayload(consultation);
  const needsConsultationUpdate =
    consultation.status !== 'finalizada' ||
    !consultation.fim_at ||
    !consultation.inicio_at ||
    !consultation.sala_id ||
    !consultation.token_sala;

  const closedConsultation = needsConsultationUpdate
    ? await repository.updateConsultationFinish({
      consultationId: consultation.id,
      status: 'finalizada',
      startedAt,
      finishedAt,
      roomId: roomPayload.roomId,
      roomToken: roomPayload.roomToken,
    })
    : consultation;

  const [appointment, queue] = await Promise.all([
    repository.findAppointmentByConsultationId(consultation.id),
    repository.findQueueEntryByConsultation(closedConsultation),
  ]);

  const nextAppointment = appointment?.id && !APPOINTMENT_COMPLETED_STATUSES.has(String(appointment.status || '')) && !APPOINTMENT_CANCELLED_STATUSES.has(String(appointment.status || ''))
    ? await repository.updateAppointmentStatus({
      appointmentId: appointment.id,
      status: 'completed',
    })
    : appointment;

  const nextQueue = queue?.id && !QUEUE_FINAL_STATUSES.has(String(queue.status || ''))
    ? await repository.updateQueueStatus({
      queueId: queue.id,
      status: 'completed',
    })
    : queue;

  console.info('[finish-consulta] request:success', {
    requestId,
    consultationId: closedConsultation.id,
    appointmentStatus: nextAppointment?.status || null,
    queueStatus: nextQueue?.status || null,
  });

  return {
    consultation: mapConsultationRecord(closedConsultation),
    appointmentStatus: nextAppointment?.status || null,
    queueStatus: nextQueue?.status || null,
    evaluationRequired: true,
  };
}
