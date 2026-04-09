import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';
import type { AppUserRecord } from '../_shared/appUsers.ts';

export type RegisterProfessionalInput = {
  fullName: string;
  profession: string;
  specialty: string;
  registerNumber: string;
  registerState: string;
  rqe: string;
  university: string;
  graduationYear: number;
  diplomaUrl: string;
  sex: string;
  phone: string;
  cpf: string;
  photoUrl: string;
  bio: string;
  instagramUrl: string;
  patientTypes: string[];
  tags: string[];
  modality: 'online' | 'presencial' | 'ambos';
  officeCity: string;
  officeState: string;
  officeAddress: string;
  galleryUrls: string[];
};

export type ProfessionalProfileRecord = {
  id: string;
  user_id: string;
  full_name: string;
  profession: string;
  specialty: string;
  status: string | null;
};

export type ProfessionalPublicProfileRecord = {
  id: string;
  professional_profile_id: string;
  user_id: string | null;
  full_name: string;
  slug: string | null;
  status: string | null;
};

export type ExistingProfessionalRecord = {
  privateProfileId: string | null;
  publicProfileId: string | null;
};

export type RegisterProfessionalResult = {
  privateProfile: ProfessionalProfileRecord;
  publicProfile: ProfessionalPublicProfileRecord;
};

export type RegisterProfessionalSuccessResponse = ApiSuccess<RegisterProfessionalResult>;
export type ErrorResponse = ApiErrorResponse;

export type RegisterProfessionalRepository = {
  findAppUserBySupabaseIdentity(params: {
    authUserId: string;
    email: string;
  }): Promise<AppUserRecord | null>;
  createAppUser(params: {
    authUserId: string;
    email: string;
    fullName: string;
    phone: string;
    cpf: string;
    sex: string;
  }): Promise<AppUserRecord>;
  updateAppUser(params: {
    appUserId: string;
    authUserId: string;
    fullName: string;
    email: string;
    phone: string;
    cpf: string;
    sex: string;
  }): Promise<AppUserRecord>;
  findExistingProfessionalByUserId(userId: string): Promise<ExistingProfessionalRecord>;
  isSlugInUse(slug: string): Promise<boolean>;
  createProfessionalProfile(params: {
    userId: string;
    fullName: string;
    profession: string;
    specialty: string;
    registerNumber: string;
    registerState: string;
    rqe: string;
    university: string;
    graduationYear: number;
    diplomaUrl: string;
    sex: string;
    phone: string;
    cpf: string;
    photoUrl: string;
    bio: string;
  }): Promise<ProfessionalProfileRecord>;
  createProfessionalPublicProfile(params: {
    professionalProfileId: string;
    userId: string;
    fullName: string;
    slug: string;
    profession: string;
    specialty: string;
    registerNumber: string;
    registerState: string;
    rqe: string;
    bio: string;
    photoUrl: string;
    graduationYear: number;
    education: string;
    tags: string[];
    patientTypes: string[];
    modality: string;
    officeCity: string;
    officeState: string;
    officeAddress: string;
    instagramUrl: string;
    galleryUrls: string[];
  }): Promise<ProfessionalPublicProfileRecord>;
};

export type RegisterProfessionalCommand = {
  requestId: string;
  input: RegisterProfessionalInput;
  authenticatedUser: AuthenticatedUser;
};
