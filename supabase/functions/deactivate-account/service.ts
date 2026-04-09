import { AppError } from '../_shared/errors.ts';
import type {
  AppUserRecord,
  DeactivateAccountCommand,
  DeactivateAccountResult,
} from './types.ts';

function assertAppUser(appUser: AppUserRecord | null) {
  if (!appUser?.id) {
    throw new AppError({
      status: 404,
      code: 'APP_USER_NOT_FOUND',
      message: 'Application user not found.',
    });
  }

  return appUser;
}

export async function deactivateAccount({
  requestId,
  authenticatedUser,
  accessToken,
  repository,
}: DeactivateAccountCommand): Promise<DeactivateAccountResult> {
  const currentUser = assertAppUser(
    await repository.findAppUserByAuthUserId(authenticatedUser.authUserId),
  );
  const deactivatedUser = currentUser.isActive
    ? await repository.deactivateAppUser(currentUser.id)
    : {
      ...currentUser,
      isActive: false,
    };

  try {
    await repository.revokeAccessToken(accessToken);
  } catch (error) {
    console.warn('[deactivate-account] revoke-session:failed', {
      requestId,
      authUserId: authenticatedUser.authUserId,
      error,
    });
  }

  console.info('[deactivate-account] request:success', {
    requestId,
    appUserId: deactivatedUser.id,
    authUserId: deactivatedUser.authUserId,
  });

  return {
    deactivated: true,
    appUser: deactivatedUser,
  };
}
