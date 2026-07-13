import { AppError } from '../_shared/errors.ts';
import type {
  AppUserRecord,
  AppUserUpsertPayload,
  BootstrapAppUserCommand,
  BootstrapAppUserResult,
  BootstrapResolvedRole,
  BootstrapRole,
} from './types.ts';

function resolveProfileComplete(payload: {
  fullName: string;
  phone: string;
  cpf: string;
  birthDate: string;
  sex: string;
}) {
  return Boolean(
    payload.fullName
    && payload.phone
    && payload.cpf
    && payload.birthDate
    && payload.sex,
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

function resolveFullName(params: {
  inputFullName: string | null;
  existingUser: AppUserRecord | null;
  authenticatedFullName: string | null;
  email: string;
}) {
  return (
    params.inputFullName?.trim()
    || params.existingUser?.fullName
    || params.authenticatedFullName?.trim()
    || params.email.split('@')[0]
    || 'Usuario'
  );
}

function resolveRole(params: {
  inputRole: BootstrapRole | null;
  existingUser: AppUserRecord | null;
  authenticatedRole: BootstrapResolvedRole | null;
  isSignup: boolean;
}) {
  if (params.existingUser?.role) {
    return params.existingUser.role;
  }

  if (params.isSignup) {
    return params.inputRole || 'patient';
  }

  return params.authenticatedRole || 'patient';
}

function buildAppUserPayload(params: {
  authUserId: string;
  email: string;
  input: BootstrapAppUserCommand['input'];
  existingUser: AppUserRecord | null;
  authenticatedRole: BootstrapResolvedRole | null;
  authenticatedFullName: string | null;
  isSignup: boolean;
}): AppUserUpsertPayload {
  const fullName = resolveFullName({
    inputFullName: params.input.fullName,
    existingUser: params.existingUser,
    authenticatedFullName: params.authenticatedFullName,
    email: params.email,
  });
  const role = resolveRole({
    inputRole: params.input.role,
    existingUser: params.existingUser,
    authenticatedRole: params.authenticatedRole,
    isSignup: params.isSignup,
  });
  const phone = params.input.phone || params.existingUser?.phone || '';
  const cpf = params.input.cpf || params.existingUser?.cpf || '';
  const birthDate = params.input.birthDate || params.existingUser?.birthDate || '';
  const sex = params.input.sex || params.existingUser?.sex || '';
  const address = params.input.address || params.existingUser?.address || '';
  const city = params.input.city || params.existingUser?.city || '';
  const state = params.input.state || params.existingUser?.state || '';

  return {
    authUserId: params.authUserId,
    fullName,
    email: params.email,
    role,
    isActive: params.existingUser?.isActive ?? true,
    phone,
    cpf,
    birthDate,
    sex,
    address,
    city,
    state,
    profileComplete: resolveProfileComplete({
      fullName,
      phone,
      cpf,
      birthDate,
      sex,
    }),
  };
}

function hasPayloadChanges(existingUser: AppUserRecord, payload: AppUserUpsertPayload) {
  return (
    existingUser.authUserId !== payload.authUserId
    || existingUser.fullName !== payload.fullName
    || existingUser.email !== payload.email
    || existingUser.role !== payload.role
    || existingUser.isActive !== payload.isActive
    || existingUser.phone !== payload.phone
    || existingUser.cpf !== payload.cpf
    || existingUser.birthDate !== payload.birthDate
    || existingUser.sex !== payload.sex
    || existingUser.address !== payload.address
    || existingUser.city !== payload.city
    || existingUser.state !== payload.state
    || existingUser.profileComplete !== payload.profileComplete
  );
}

function assertExistingLink(existingUser: AppUserRecord | null, authUserId: string) {
  if (!existingUser?.id) {
    return;
  }

  if (existingUser.authUserId && existingUser.authUserId !== authUserId) {
    throw new AppError({
      status: 409,
      code: 'APP_USER_ALREADY_LINKED',
      message: 'This application profile is already linked to another auth user.',
    });
  }

  if (existingUser.isActive === false) {
    throw new AppError({
      status: 403,
      code: 'ACCOUNT_INACTIVE',
      message: 'Authenticated account is inactive.',
    });
  }
}

async function upsertAppUser(params: {
  existingUser: AppUserRecord | null;
  payload: AppUserUpsertPayload;
  repository: BootstrapAppUserCommand['repository'];
}) {
  if (!params.existingUser?.id) {
    return params.repository.createAppUser(params.payload);
  }

  if (!hasPayloadChanges(params.existingUser, params.payload)) {
    return params.existingUser;
  }

  return params.repository.updateAppUser(params.existingUser.id, params.payload);
}

async function rollbackAuthUser(
  repository: BootstrapAppUserCommand['repository'],
  authUserId: string,
  requestId: string,
) {
  try {
    await repository.deleteAuthUser(authUserId);
  } catch (rollbackError) {
    console.error('[bootstrap-app-user] rollback:failed', {
      requestId,
      authUserId,
      rollbackError,
    });
  }
}

async function rollbackAppUser(
  repository: BootstrapAppUserCommand['repository'],
  appUserId: string,
  requestId: string,
) {
  try {
    await repository.deleteAppUser(appUserId);
  } catch {
    console.error('[bootstrap-app-user] app-user-rollback:failed', {
      requestId,
      appUserId,
    });
  }
}

async function runSignupBootstrap({
  requestId,
  input,
  repository,
}: BootstrapAppUserCommand): Promise<BootstrapAppUserResult> {
  if (!input.email || !input.password) {
    throw new AppError({
      status: 400,
      code: 'SIGNUP_CREDENTIALS_REQUIRED',
      message: 'Email and password are required for signup bootstrap.',
    });
  }

  if (!input.fullName?.trim()) {
    throw new AppError({
      status: 400,
      code: 'FULL_NAME_REQUIRED',
      message: 'Full name is required for signup bootstrap.',
    });
  }

  if (!input.termsAccepted || !input.privacyAcknowledged) {
    throw new AppError({
      status: 400,
      code: 'LEGAL_ACKNOWLEDGEMENTS_REQUIRED',
      message: 'Terms acceptance and privacy notice acknowledgement are required for signup.',
    });
  }

  const role = input.role || 'patient';
  const createdAuthUser = await repository.createAuthUser({
    email: input.email,
    password: input.password,
    fullName: input.fullName.trim(),
    role,
  });

  try {
    const session = await repository.signInWithPassword({
      email: createdAuthUser.email,
      password: input.password,
    });
    const existingUser = await repository.findAppUserByAuthUserId(createdAuthUser.authUserId)
      || await repository.findAppUserByEmail(createdAuthUser.email);

    assertExistingLink(existingUser, createdAuthUser.authUserId);

    const payload = buildAppUserPayload({
      authUserId: createdAuthUser.authUserId,
      email: createdAuthUser.email,
      input,
      existingUser,
      authenticatedRole: role,
      authenticatedFullName: input.fullName,
      isSignup: true,
    });
    const appUser = assertActiveAppUser(await upsertAppUser({
      existingUser,
      payload,
      repository,
    }));
    let legalEvents;

    try {
      legalEvents = await repository.recordSignupLegalEvents({
        userId: appUser.id,
        role,
      });
    } catch (error) {
      if (!existingUser?.id) {
        await rollbackAppUser(repository, appUser.id, requestId);
      }
      throw error;
    }

    console.info('[bootstrap-app-user] signup:success', {
      requestId,
      appUserId: appUser.id,
      authUserId: appUser.authUserId,
      role: appUser.role,
    });

    return {
      appUser,
      session,
      created: !existingUser?.id,
      legalEvents,
    };
  } catch (error) {
    await rollbackAuthUser(repository, createdAuthUser.authUserId, requestId);
    throw error;
  }
}

async function runSessionBootstrap({
  requestId,
  input,
  authenticatedUser,
  repository,
}: BootstrapAppUserCommand): Promise<BootstrapAppUserResult> {
  if (!authenticatedUser?.authUserId || !authenticatedUser.email) {
    throw new AppError({
      status: 401,
      code: 'AUTH_REQUIRED',
      message: 'Authenticated user is required.',
    });
  }

  const existingUser = await repository.findAppUserByAuthUserId(authenticatedUser.authUserId)
    || await repository.findAppUserByEmail(authenticatedUser.email);

  assertExistingLink(existingUser, authenticatedUser.authUserId);

  const payload = buildAppUserPayload({
    authUserId: authenticatedUser.authUserId,
    email: authenticatedUser.email,
    input,
    existingUser,
    authenticatedRole: authenticatedUser.role,
    authenticatedFullName: authenticatedUser.fullName,
    isSignup: false,
  });
  const appUser = assertActiveAppUser(await upsertAppUser({
    existingUser,
    payload,
    repository,
  }));

  console.info('[bootstrap-app-user] restore:success', {
    requestId,
    appUserId: appUser.id,
    authUserId: appUser.authUserId,
    created: !existingUser?.id,
  });

  return {
    appUser,
    session: null,
    created: !existingUser?.id,
  };
}

export async function bootstrapAppUser(command: BootstrapAppUserCommand): Promise<BootstrapAppUserResult> {
  const isSignup = Boolean(command.input.email && command.input.password);

  if (isSignup && command.authenticatedUser) {
    throw new AppError({
      status: 409,
      code: 'AUTH_SESSION_ALREADY_EXISTS',
      message: 'Cannot bootstrap a new account while another session is active.',
    });
  }

  if (isSignup) {
    return runSignupBootstrap(command);
  }

  return runSessionBootstrap(command);
}
