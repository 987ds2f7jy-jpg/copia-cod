import { AppError } from '../_shared/errors.ts';
import {
  notifyInternalBestEffort,
  type InternalNotificationNotifier,
} from '../_shared/notifications/notify-best-effort.ts';
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
import {
  getScheduledConsultationDeadline,
} from '../_shared/scheduled-consultation-deadline.ts';
import type {
  StartConsultaSessionCommand,
  StartConsultaSessionRepository,
  StartConsultaSessionResult,
} from './types.ts';

const QUEUE_FINAL_STATUSES = new Set(['completed', 'cancelled']);

function assertScheduledConsultationStartWindow(consultation: {
  tipo_consulta?: string | null;
  datetime?: string | null;
  status?: string | null;
  inicio_at?: string | null;
}) {
  const deadline = getScheduledConsultationDeadline(consultation);

  if (deadline.state === 'before_start') {
    throw new AppError({
      status: 409,
      code: 'CONSULTATION_START_TOO_EARLY',
      message: 'A sessão só pode ser iniciada no horário agendado.',
    });
  }

  if (deadline.state === 'deadline_elapsed') {
    throw new AppError({
      status: 409,
      code: 'CONSULTATION_START_DEADLINE_ELAPSED',
      message: 'Não é mais possível iniciar esta consulta: o prazo de entrada foi encerrado.',
    });
  }

  if (deadline.state === 'invalid_schedule') {
    throw new AppError({
      status: 409,
      code: 'CONSULTATION_SCHEDULE_INVALID',
      message: 'O horário agendado desta consulta precisa ser revisado antes do início.',
    });
  }
}

export async function startConsultaSession({
  requestId,
  input,
  authenticatedUser,
  repository,
  notificationService,
}: {
  repository: StartConsultaSessionRepository;
  notificationService?: InternalNotificationNotifier;
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

  assertScheduledConsultationStartWindow(consultation);

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

  const roomPayload = buildConsultaRoomPayload(consultation);
  const transitionedToStarted = consultation.status !== 'em_atendimento';
  const requiresConsultationUpdate =
    transitionedToStarted ||
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
    ? await repository.startConsultationSessionAtomically({
      consultationId: consultation.id,
      roomId: roomPayload.roomId,
      roomToken: roomPayload.roomToken,
    })
    : consultation;

  // The transactional RPC updates the linked scheduled appointment together
  // with the consultation. Re-read it for the response rather than applying a
  // second non-atomic update in this process.
  const nextAppointment = requiresConsultationUpdate
    ? await repository.findAppointmentByConsultationId(consultation.id)
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

  if (transitionedToStarted && notificationService) {
    await notifyInternalBestEffort({
      notificationService,
      functionName: 'start-consulta-session',
      requestId,
      input: {
        recipientUserId: updatedConsultation.paciente_id,
        typeKey: 'teleconsulta.started',
        relatedEntityType: 'consulta',
        relatedEntityId: updatedConsultation.id,
        deduplicationKey: `consulta:${updatedConsultation.id}:started:patient:${updatedConsultation.paciente_id}`,
      },
    });
  }

  return {
    consultation: mapConsultationRecord(updatedConsultation),
    participantRole,
    started: requiresConsultationUpdate,
    appointmentStatus: nextAppointment?.status || null,
    queueStatus: nextQueue?.status || null,
  };
}
