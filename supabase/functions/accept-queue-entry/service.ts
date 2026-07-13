import { AppError } from '../_shared/errors.ts';
import { logTechnicalEvent } from '../_shared/observability.ts';
import { isApprovedProfessionalStatus } from '../_shared/domains/professionalStatus.ts';
import type {
  AcceptQueueEntryCommand,
  AcceptQueueEntryRepository,
  AcceptQueueEntryResult,
} from './types.ts';

const DUTY_SPECIALTIES = ['clinico_geral', 'pediatria', 'psicologia', 'psiquiatria'];
const SPECIALTY_ALIASES: Record<string, string> = {
  psicologia_clinica: 'psicologia',
};

function normalizePlantaoSpecialty(value: string) {
  const normalized = (value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

  return SPECIALTY_ALIASES[normalized] || normalized;
}

export async function acceptQueueEntry({
  requestId,
  queueId,
  authenticatedUser,
  repository,
}: {
  repository: AcceptQueueEntryRepository;
} & AcceptQueueEntryCommand): Promise<AcceptQueueEntryResult> {
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
      message: 'Only professionals can accept queue entries.',
    });
  }

  const professional = await repository.findProfessionalDutyContextByUserId(appUser.id);

  if (!professional?.profileId) {
    throw new AppError({
      status: 403,
      code: 'PROFESSIONAL_PROFILE_NOT_FOUND',
      message: 'No active professional profile was found for this user.',
    });
  }

  if (!isApprovedProfessionalStatus(professional.publicStatus)) {
    throw new AppError({
      status: 403,
      code: 'PROFESSIONAL_PROFILE_NOT_ELIGIBLE',
      message: 'Professional public profile must be approved for duty.',
    });
  }

  if (!professional.isOnDuty) {
    throw new AppError({
      status: 409,
      code: 'PROFESSIONAL_NOT_ON_DUTY',
      message: 'Professional must be on duty to accept queue entries.',
    });
  }

  const normalizedSpecialty = normalizePlantaoSpecialty(professional.specialty);

  if (!normalizedSpecialty) {
    throw new AppError({
      status: 422,
      code: 'PROFESSIONAL_SPECIALTY_REQUIRED',
      message: 'Professional specialty is required.',
    });
  }

  if (!DUTY_SPECIALTIES.includes(normalizedSpecialty)) {
    throw new AppError({
      status: 403,
      code: 'PROFESSIONAL_SPECIALTY_NOT_ELIGIBLE',
      message: 'Professional specialty is not eligible for duty.',
    });
  }

  logTechnicalEvent('info', {
    functionName: 'accept-queue-entry',
    requestId,
    operation: 'queue.accept',
    actorId: appUser.id,
    actorRole: appUser.role,
    resourceType: 'queue',
    resourceId: queueId,
    status: 'started',
  });

  const planContext = await repository.findPlanQueueAcceptanceContext(queueId);

  if (planContext) {
    if (planContext.queue.status !== 'waiting') {
      throw new AppError({
        status: 409,
        code: 'QUEUE_NOT_WAITING',
        message: 'Queue entry is no longer available for assignment.',
      });
    }

    if (normalizePlantaoSpecialty(planContext.queue.specialty) !== normalizedSpecialty) {
      throw new AppError({
        status: 403,
        code: 'QUEUE_SPECIALTY_MISMATCH',
        message: 'Professional is not allowed to accept this queue entry.',
      });
    }

    if (planContext.queue.paymentRequired || !planContext.queue.planCreditUsageId || !planContext.usage?.id) {
      throw new AppError({
        status: 409,
        code: 'PLAN_QUEUE_CREDIT_USAGE_REQUIRED',
        message: 'Plan-funded queue entries require a valid credit reservation.',
        details: { queueId },
      });
    }

    const creditResult = await repository.confirmPlanCreditBeforeAcceptance({ context: planContext });

    logTechnicalEvent('info', {
      functionName: 'accept-queue-entry',
      requestId,
      operation: 'plan_credit.confirm',
      actorId: appUser.id,
      actorRole: appUser.role,
      resourceType: 'queue',
      resourceId: queueId,
      status: creditResult.reason,
    });
  }

  const row = await repository.acceptQueueEntry({
    queueId,
    professionalAppUserId: professional.appUserId,
    professionalProfileId: professional.profileId,
    planFunded: Boolean(planContext),
  });

  logTechnicalEvent('info', {
    functionName: 'accept-queue-entry',
    requestId,
    operation: 'queue.accept',
    actorId: appUser.id,
    actorRole: appUser.role,
    resourceType: 'queue',
    resourceId: row.queue_id,
    status: 'succeeded',
  });

  return {
    queue: {
      id: row.queue_id,
      status: row.queue_status,
      assignedProfessionalId: row.queue_assigned_professional_id,
      patientId: row.queue_patient_id,
      patientName: row.queue_patient_name,
      specialty: row.queue_specialty,
      position: Number(row.queue_position || 0),
      estimatedWaitTime: Number(row.queue_estimated_wait_time || 0),
      solicitacaoExameId: row.queue_solicitacao_exame_id || '',
    },
    consulta: {
      id: row.consulta_id,
      status: row.consulta_status,
      tipoConsulta: row.consulta_tipo,
      datetime: row.consulta_datetime,
      professionalId: row.consulta_professional_id,
      professionalUserId: row.consulta_professional_user_id,
      professionalName: row.consulta_professional_name,
    },
  };
}
