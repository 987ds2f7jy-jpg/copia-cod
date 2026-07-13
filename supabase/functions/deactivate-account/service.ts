import { AppError } from '../_shared/errors.ts';
import type {
  AppUserRecord,
  DeactivateAccountCommand,
  DeactivateAccountResult,
} from './types.ts';
import { logTechnicalEvent, sanitizeErrorCode } from '../_shared/observability.ts';

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
  input: _input,
  repository,
}: DeactivateAccountCommand): Promise<DeactivateAccountResult> {
  const currentUser = assertAppUser(
    await repository.findAppUserByAuthUserId(authenticatedUser.authUserId),
  );
  if (currentUser.isActive && await repository.hasActiveCareRelationship(currentUser)) {
    throw new AppError({
      status: 409,
      code: 'ACCOUNT_DEACTIVATION_ACTIVE_RELATIONSHIP',
      message: 'Account deactivation requires administrative review while care relationships are active.',
    });
  }

  if (currentUser.role === 'professional') {
    await repository.disableProfessionalDuty(currentUser.id);
  }

  const deactivatedUser = currentUser.isActive
    ? await repository.deactivateAppUser(currentUser.id)
    : {
      ...currentUser,
      isActive: false,
    };

  try {
    await repository.revokeAccessToken(accessToken);
  } catch (error) {
    logTechnicalEvent('warn', {
      functionName: 'deactivate-account',
      requestId,
      operation: 'account.sessions.revoke',
      actorId: deactivatedUser.id,
      actorRole: deactivatedUser.role as 'patient' | 'professional' | 'admin',
      resourceType: 'app_user',
      resourceId: deactivatedUser.id,
      status: 'failed',
      errorCode: sanitizeErrorCode(error),
    });
  }

  await repository.writeAudit({ appUser: deactivatedUser, requestId });
  logTechnicalEvent('info', {
    functionName: 'deactivate-account',
    requestId,
    operation: 'account.deactivate',
    actorId: deactivatedUser.id,
    actorRole: deactivatedUser.role as 'patient' | 'professional' | 'admin',
    resourceType: 'app_user',
    resourceId: deactivatedUser.id,
    status: 'succeeded',
  });

  return {
    deactivated: true,
    appUser: deactivatedUser,
  };
}
