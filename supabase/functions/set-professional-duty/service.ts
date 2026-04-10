import { AppError } from '../_shared/errors.ts';
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

  const professionalId = await repository.findProfessionalProfileIdByAppUserId(appUserId);

  if (!professionalId) {
    throw new AppError({
      status: 404,
      code: 'PROFESSIONAL_PROFILE_NOT_FOUND',
      message: 'Professional profile not found.',
    });
  }

  const publicProfileId = await repository.findPublicProfileIdByProfessionalId(professionalId);

  await repository.updateProfessionalDuty({ professionalId, isOnDuty: input.isOnDuty });

  if (publicProfileId) {
    await repository.updatePublicDuty({ publicProfileId, isOnDuty: input.isOnDuty });
  }

  console.info('[set-professional-duty] request:success', {
    requestId,
    professionalId,
    publicProfileId: publicProfileId || null,
    isOnDuty: input.isOnDuty,
  });

  return {
    professionalId,
    publicProfileId: publicProfileId || null,
    isOnDuty: input.isOnDuty,
  };
}

