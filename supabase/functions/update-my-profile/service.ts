import { AppError } from '../_shared/errors.ts';
import type {
  AppUserRecord,
  UpdateMyProfileCommand,
  UpdateMyProfileResult,
} from './types.ts';

function resolveProfileComplete(params: {
  fullName: string;
  phone: string;
  cpf: string;
  birthDate: string;
  sex: string;
}) {
  return Boolean(
    params.fullName
    && params.phone
    && params.cpf
    && params.birthDate
    && params.sex,
  );
}

function assertActiveAppUser(appUser: AppUserRecord | null) {
  if (!appUser?.id) {
    throw new AppError({
      status: 404,
      code: 'APP_USER_NOT_FOUND',
      message: 'Application user not found.',
    });
  }

  if (appUser.isActive === false) {
    throw new AppError({
      status: 403,
      code: 'ACCOUNT_INACTIVE',
      message: 'Authenticated account is inactive.',
    });
  }

  return appUser;
}

function hasProfileChanges(currentUser: AppUserRecord, nextUser: AppUserRecord) {
  return (
    currentUser.fullName !== nextUser.fullName
    || currentUser.phone !== nextUser.phone
    || currentUser.cpf !== nextUser.cpf
    || currentUser.birthDate !== nextUser.birthDate
    || currentUser.sex !== nextUser.sex
    || currentUser.address !== nextUser.address
    || currentUser.city !== nextUser.city
    || currentUser.state !== nextUser.state
    || currentUser.profileComplete !== nextUser.profileComplete
  );
}

export async function updateMyProfile({
  requestId,
  authenticatedUser,
  input,
  repository,
}: UpdateMyProfileCommand): Promise<UpdateMyProfileResult> {
  const currentUser = assertActiveAppUser(
    await repository.findAppUserByAuthUserId(authenticatedUser.authUserId),
  );
  const nextUser: AppUserRecord = {
    ...currentUser,
    fullName: input.fullName ?? currentUser.fullName,
    phone: input.phone ?? currentUser.phone,
    cpf: input.cpf ?? currentUser.cpf,
    birthDate: input.birthDate ?? currentUser.birthDate,
    sex: input.sex ?? currentUser.sex,
    address: input.address ?? currentUser.address,
    city: input.city ?? currentUser.city,
    state: input.state ?? currentUser.state,
    profileComplete: false,
  };

  nextUser.profileComplete = resolveProfileComplete({
    fullName: nextUser.fullName,
    phone: nextUser.phone,
    cpf: nextUser.cpf,
    birthDate: nextUser.birthDate,
    sex: nextUser.sex,
  });

  const updatedUser = hasProfileChanges(currentUser, nextUser)
    ? await repository.updateAppUser(currentUser.id, {
      fullName: nextUser.fullName,
      phone: nextUser.phone,
      cpf: nextUser.cpf,
      birthDate: nextUser.birthDate,
      sex: nextUser.sex,
      address: nextUser.address,
      city: nextUser.city,
      state: nextUser.state,
      profileComplete: nextUser.profileComplete,
    })
    : currentUser;

  try {
    if (updatedUser.fullName !== currentUser.fullName) {
      await repository.updateAuthMetadata({
        authUserId: authenticatedUser.authUserId,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
      });
    }
  } catch (error) {
    console.warn('[update-my-profile] auth-metadata:failed', {
      requestId,
      authUserId: authenticatedUser.authUserId,
      error,
    });
  }

  console.info('[update-my-profile] request:success', {
    requestId,
    appUserId: updatedUser.id,
    authUserId: updatedUser.authUserId,
  });

  return {
    appUser: updatedUser,
  };
}
