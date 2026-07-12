import { AppError } from '../_shared/errors.ts';
import { isApprovedProfessionalStatus } from '../_shared/domains/professionalStatus.ts';
import { getOnDutyServiceCodeForSpecialty } from '../_shared/pricing/service-codes.ts';
import type {
  SetProfessionalDutyCommand,
  SetProfessionalDutyRepository,
  SetProfessionalDutyResult,
} from './types.ts';

export async function setProfessionalDuty({
  requestId,
  input,
  authenticatedUser,
  appUserId,
  repository,
}: {
  appUserId: string;
  repository: SetProfessionalDutyRepository;
} & SetProfessionalDutyCommand): Promise<SetProfessionalDutyResult> {
  console.info('[set-professional-duty] request:start', {
    requestId,
    authUserId: authenticatedUser.authUserId,
    appUserId,
    isOnDuty: input.isOnDuty,
  });

  const profile = await repository.findProfessionalDutyProfileByAppUserId(appUserId);

  if (!profile?.professionalId) {
    throw new AppError({
      status: 403,
      code: 'PROFESSIONAL_PROFILE_NOT_FOUND',
      message: 'Professional profile not found.',
    });
  }

  if (input.isOnDuty) {
    if (!isApprovedProfessionalStatus(profile.status) || !isApprovedProfessionalStatus(profile.publicStatus)) {
      throw new AppError({
        status: 403,
        code: 'PROFESSIONAL_DUTY_NOT_AUTHORIZED',
        message: 'Only approved professionals can activate duty.',
      });
    }

    if (!profile.publicProfileId) {
      throw new AppError({
        status: 403,
        code: 'PROFESSIONAL_PUBLIC_PROFILE_REQUIRED',
        message: 'An approved public profile is required to activate duty.',
      });
    }

    if (!getOnDutyServiceCodeForSpecialty(profile.specialty)) {
      throw new AppError({
        status: 403,
        code: 'PROFESSIONAL_SPECIALTY_NOT_ELIGIBLE',
        message: 'Professional specialty is not eligible for duty.',
      });
    }
  }

  await repository.updateProfessionalDuty({
    professionalId: profile.professionalId,
    isOnDuty: input.isOnDuty,
  });

  if (profile.publicProfileId) {
    await repository.updatePublicDuty({
      publicProfileId: profile.publicProfileId,
      isOnDuty: input.isOnDuty,
    });
  }

  console.info('[set-professional-duty] request:success', {
    requestId,
    professionalId: profile.professionalId,
    publicProfileId: profile.publicProfileId,
    isOnDuty: input.isOnDuty,
  });

  return {
    professionalId: profile.professionalId,
    publicProfileId: profile.publicProfileId,
    isOnDuty: input.isOnDuty,
  };
}

