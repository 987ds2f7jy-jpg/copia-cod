import { AppError } from '../_shared/errors.ts';
import {
  buildConsultaRoomPayload,
  isConsultaClosed,
  mapConsultationRecord,
  mapProntuarioRecord,
  resolveConsultaParticipantRole,
} from '../_shared/teleconsulta.ts';
import type {
  UpsertProntuarioCommand,
  UpsertProntuarioRepository,
  UpsertProntuarioResult,
} from './types.ts';

const APPOINTMENT_FINAL_STATUSES = new Set(['completed', 'cancelled', 'CANCELADO', 'CONCLUIDO']);
const QUEUE_FINAL_STATUSES = new Set(['completed', 'cancelled']);

export async function upsertProntuario({
  requestId,
  input,
  authenticatedUser,
  repository,
}: {
  repository: UpsertProntuarioRepository;
} & UpsertProntuarioCommand): Promise<UpsertProntuarioResult> {
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
      message: 'Only professionals can manage consultation medical records.',
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

  const participantRole = resolveConsultaParticipantRole({
    consulta: consultation,
    appUserId: appUser.id,
    professionalProfileId: professionalIdentity?.profileId || null,
  });

  if (participantRole !== 'professional') {
    throw new AppError({
      status: 403,
      code: 'CONSULTATION_ACCESS_FORBIDDEN',
      message: 'Authenticated professional does not belong to this consultation.',
    });
  }

  if (isConsultaClosed(consultation.status)) {
    throw new AppError({
      status: 409,
      code: 'CONSULTATION_ALREADY_CLOSED',
      message: 'Closed consultations cannot receive new medical-record updates.',
    });
  }

  console.info('[upsert-prontuario] request:start', {
    requestId,
    consultationId: consultation.id,
    professionalId: consultation.profissional_id,
  });

  const roomPayload = buildConsultaRoomPayload(consultation);
  const startedAt = consultation.inicio_at || new Date().toISOString();
  const requiresSessionUpdate =
    consultation.status !== 'em_atendimento' ||
    !consultation.inicio_at ||
    !consultation.sala_id ||
    !consultation.token_sala;

  const activeConsultation = requiresSessionUpdate
    ? await repository.updateConsultationSession({
      consultationId: consultation.id,
      status: 'em_atendimento',
      startedAt,
      roomId: roomPayload.roomId,
      roomToken: roomPayload.roomToken,
    })
    : consultation;

  const [appointment, queue, existingProntuario] = await Promise.all([
    repository.findAppointmentByConsultationId(consultation.id),
    repository.findQueueEntryByConsultation(activeConsultation),
    repository.findProntuarioByConsultationId(consultation.id),
  ]);

  if (appointment?.id && !APPOINTMENT_FINAL_STATUSES.has(String(appointment.status || ''))) {
    await repository.updateAppointmentStatus({
      appointmentId: appointment.id,
      status: 'in_progress',
    });
  }

  if (queue?.id && !QUEUE_FINAL_STATUSES.has(String(queue.status || ''))) {
    await repository.updateQueueStatus({
      queueId: queue.id,
      status: 'em_atendimento',
    });
  }

  const professionalId = professionalIdentity?.profileId || activeConsultation.profissional_id;
  const prontuario = existingProntuario?.id
    ? await repository.updateProntuario({
      prontuarioId: existingProntuario.id,
      mode: input.mode,
      motivoConsulta: input.motivoConsulta,
      historicoRisco: input.historicoRisco,
      examesImagem: input.examesImagem,
      exameFisico: input.exameFisico,
      avaliacaoDiagnostico: input.avaliacaoDiagnostico,
      recomendacoes: input.recomendacoes,
    })
    : await repository.createProntuario({
      consultationId: activeConsultation.id,
      patientId: activeConsultation.paciente_id,
      professionalId,
      mode: input.mode,
      motivoConsulta: input.motivoConsulta,
      historicoRisco: input.historicoRisco,
      examesImagem: input.examesImagem,
      exameFisico: input.exameFisico,
      avaliacaoDiagnostico: input.avaliacaoDiagnostico,
      recomendacoes: input.recomendacoes,
    });

  console.info('[upsert-prontuario] request:success', {
    requestId,
    consultationId: activeConsultation.id,
    prontuarioId: prontuario.id,
    created: !existingProntuario?.id,
  });

  return {
    consultation: mapConsultationRecord(activeConsultation),
    prontuario: mapProntuarioRecord(prontuario),
    created: !existingProntuario?.id,
  };
}
