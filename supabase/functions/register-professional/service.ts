import { AppError } from '../_shared/errors.ts';
import { normalizeUploadPath, normalizeUploadPathList } from '../_shared/uploadPaths.ts';
import type {
  RegisterProfessionalCommand,
  RegisterProfessionalRepository,
  RegisterProfessionalResult,
} from './types.ts';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function resolveUniqueSlug(
  repository: RegisterProfessionalRepository,
  baseSlug: string,
) {
  let candidate = baseSlug || `profissional-${crypto.randomUUID().slice(0, 8)}`;
  let counter = 2;

  while (await repository.isSlugInUse(candidate)) {
    candidate = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return candidate;
}

export async function registerProfessional({
  requestId,
  input,
  authenticatedUser,
  repository,
}: {
  repository: RegisterProfessionalRepository;
} & RegisterProfessionalCommand): Promise<RegisterProfessionalResult> {
  const authEmail = String(authenticatedUser.email || '').trim().toLowerCase();

  if (!authenticatedUser.authUserId) {
    throw new AppError({
      status: 401,
      code: 'AUTH_USER_INVALID',
      message: 'Unable to resolve authenticated user.',
    });
  }

  let appUser = await repository.findAppUserBySupabaseIdentity({
    authUserId: authenticatedUser.authUserId,
    email: authEmail,
  });

  if (!appUser?.id) {
    if (!authEmail) {
      throw new AppError({
        status: 409,
        code: 'APP_USER_MISSING_EMAIL',
        message: 'Authenticated user email is required to create app_users.',
      });
    }

    appUser = await repository.createAppUser({
      authUserId: authenticatedUser.authUserId,
      email: authEmail,
      fullName: input.fullName,
      phone: input.phone,
      cpf: input.cpf,
      sex: input.sex,
    });
  } else {
    appUser = await repository.updateAppUser({
      appUserId: appUser.id,
      authUserId: authenticatedUser.authUserId,
      fullName: input.fullName,
      email: authEmail || appUser.email,
      phone: input.phone,
      cpf: input.cpf,
      sex: input.sex,
    });
  }

  if (appUser.isActive === false) {
    throw new AppError({
      status: 403,
      code: 'ACCOUNT_INACTIVE',
      message: 'Authenticated account is inactive.',
    });
  }

  const existingProfessional = await repository.findExistingProfessionalByUserId(appUser.id);

  if (existingProfessional.privateProfileId || existingProfessional.publicProfileId) {
    throw new AppError({
      status: 409,
      code: 'PROFESSIONAL_PROFILE_ALREADY_EXISTS',
      message: 'A professional profile already exists for this account.',
    });
  }

  const slug = await resolveUniqueSlug(
    repository,
    slugify(`${input.fullName}-${input.specialty}`),
  );
  const diplomaUrl = normalizeUploadPath(input.diplomaUrl, {
    allowedPrefixes: ['professionals/diplomas/'],
    fieldName: 'diplomaUrl',
  });
  const photoUrl = normalizeUploadPath(input.photoUrl, {
    allowedPrefixes: ['professionals/photos/'],
    fieldName: 'photoUrl',
  });
  const galleryUrls = normalizeUploadPathList(input.galleryUrls, {
    allowedPrefixes: ['professionals/gallery/'],
    fieldName: 'galleryUrls',
  });

  console.info('[register-professional] request:start', {
    requestId,
    appUserId: appUser.id,
    authUserId: authenticatedUser.authUserId,
    specialty: input.specialty,
  });

  const privateProfile = await repository.createProfessionalProfile({
    userId: appUser.id,
    fullName: input.fullName,
    profession: input.profession,
    specialty: input.specialty,
    registerNumber: input.registerNumber,
    registerState: input.registerState,
    rqe: input.rqe,
    university: input.university,
    graduationYear: input.graduationYear,
    diplomaUrl,
    sex: input.sex,
    phone: input.phone,
    cpf: input.cpf,
    photoUrl,
    bio: input.bio,
  });

  const publicProfile = await repository.createProfessionalPublicProfile({
    professionalProfileId: privateProfile.id,
    userId: appUser.id,
    fullName: input.fullName,
    slug,
    profession: input.profession,
    specialty: input.specialty,
    registerNumber: input.registerNumber,
    registerState: input.registerState,
    rqe: input.rqe,
    bio: input.bio,
    photoUrl,
    graduationYear: input.graduationYear,
    education: input.university,
    tags: input.tags,
    patientTypes: input.patientTypes,
    modality: input.modality,
    officeCity: input.officeCity,
    officeState: input.officeState,
    officeAddress: input.officeAddress,
    instagramUrl: input.instagramUrl,
    galleryUrls,
  });

  console.info('[register-professional] request:success', {
    requestId,
    appUserId: appUser.id,
    privateProfileId: privateProfile.id,
    publicProfileId: publicProfile.id,
  });

  return {
    privateProfile,
    publicProfile,
  };
}
