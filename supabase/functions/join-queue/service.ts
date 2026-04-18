import { AppError } from '../_shared/errors.ts';
import { isApprovedProfessionalStatus } from '../_shared/domains/professionalStatus.ts';
import {
  getOnDutyServiceCodeForSpecialty,
  normalizePricingSpecialty,
} from '../_shared/pricing/service-codes.ts';
import type {
  JoinQueueCommand,
  JoinQueueRepository,
  JoinQueueResult,
} from './types.ts';

function normalizePlantaoSpecialty(value: string) {
  return normalizePricingSpecialty(value);
}

export async function joinQueue({
  requestId,
  input,
  authenticatedUser,
  repository,
}: {
  repository: JoinQueueRepository;
} & JoinQueueCommand): Promise<JoinQueueResult> {
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
      message: 'Professional accounts cannot join the patient queue.',
    });
  }

  const activeConsulta = await repository.findActivePlantaoConsultaByPatientId(appUser.id);

  if (activeConsulta?.id) {
    throw new AppError({
      status: 409,
      code: 'ACTIVE_PLANTAO_CONSULTA_EXISTS',
      message: 'Patient already has an active on-duty consultation.',
    });
  }

  const existingEntry = await repository.findCurrentActiveQueueEntry(appUser.id);

  if (existingEntry?.id) {
    return {
      queueEntry: {
        id: existingEntry.id,
        status: existingEntry.status || '',
        specialty: existingEntry.specialty || '',
        position: Number(existingEntry.position || 0),
        estimatedWaitTime: Number(existingEntry.estimated_wait_time || 0),
        assignedProfessionalId: existingEntry.assigned_professional_id || '',
        solicitacaoExameId: existingEntry.solicitacao_exame_id || '',
      },
      reusedExisting: true,
    };
  }

  const normalizedSpecialty = normalizePlantaoSpecialty(input.specialty);
  const serviceCode = getOnDutyServiceCodeForSpecialty(input.specialty);

  if (!serviceCode) {
    throw new AppError({
      status: 422,
      code: 'DUTY_SPECIALTY_NOT_PRICED',
      message: 'Selected on-duty specialty is not supported for pricing.',
      details: { specialty: input.specialty, normalizedSpecialty },
    });
  }

  const availableProfiles = await repository.listOnDutyPublicProfiles();
  const hasAvailableProfessionals = availableProfiles.some((profile) =>
    profile.isOnDuty &&
    isApprovedProfessionalStatus(profile.status) &&
    normalizePlantaoSpecialty(profile.specialty) === normalizedSpecialty
  );

  if (!hasAvailableProfessionals) {
    throw new AppError({
      status: 409,
      code: 'NO_ON_DUTY_PROFESSIONAL_AVAILABLE',
      message: 'No professional is currently on duty for the selected specialty.',
    });
  }

  const waitingCount = await repository.countWaitingQueueBySpecialty(input.specialty);
  const position = waitingCount + 1;
  const estimatedWaitTime = position * 10;
  const pricing = await repository.resolveServicePricing({ serviceCode });

  console.info('[join-queue] request:start', {
    requestId,
    patientId: appUser.id,
    specialty: normalizedSpecialty,
    serviceCode,
    position,
  });

  const queueEntry = await repository.createQueueEntry({
    patientId: appUser.id,
    patientName: appUser.fullName,
    patientEmail: appUser.email,
    specialty: input.specialty,
    symptoms: input.symptoms,
    priorityLevel: input.priorityLevel,
    position,
    estimatedWaitTime,
    solicitacaoExameId: input.solicitacaoExameId,
    pricing,
  });

  console.info('[join-queue] request:success', {
    requestId,
    queueId: queueEntry.id,
    patientId: queueEntry.patient_id,
    position: queueEntry.position,
    serviceCode: queueEntry.service_code,
    quotedGrossPrice: queueEntry.quoted_gross_price,
  });

  return {
    queueEntry: {
      id: queueEntry.id,
      status: queueEntry.status || 'waiting',
      specialty: queueEntry.specialty || input.specialty,
      position: Number(queueEntry.position || position),
      estimatedWaitTime: Number(queueEntry.estimated_wait_time || estimatedWaitTime),
      assignedProfessionalId: queueEntry.assigned_professional_id || '',
      solicitacaoExameId: queueEntry.solicitacao_exame_id || input.solicitacaoExameId,
    },
    reusedExisting: false,
  };
}
