import { AppError } from '../_shared/errors.ts';
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

  console.info('[accept-queue-entry] request:start', {
    requestId,
    queueId,
    appUserId: appUser.id,
    profileId: professional.profileId,
    specialty: normalizedSpecialty,
  });

  const row = await repository.acceptQueueEntry({
    queueId,
    professionalAppUserId: professional.appUserId,
    professionalProfileId: professional.profileId,
  });

  console.info('[accept-queue-entry] request:success', {
    requestId,
    queueId: row.queue_id,
    consultaId: row.consulta_id,
    professionalId: row.consulta_professional_id,
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
