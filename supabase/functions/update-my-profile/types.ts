import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';

export type UpdateMyProfileInput = {
  fullName?: string;
  phone?: string;
  cpf?: string;
  birthDate?: string;
  sex?: string;
  address?: string;
  city?: string;
  state?: string;
};

export type AppUserRecord = {
  id: string;
  authUserId: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  phone: string;
  cpf: string;
  birthDate: string;
  sex: string;
  address: string;
  city: string;
  state: string;
  profileComplete: boolean;
};

export type UpdateMyProfileResult = {
  appUser: AppUserRecord;
};

export type UpdateMyProfileSuccessResponse = ApiSuccess<UpdateMyProfileResult>;
export type ErrorResponse = ApiErrorResponse;

export type UpdateMyProfileRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  updateAppUser(appUserId: string, payload: {
    fullName: string;
    phone: string;
    cpf: string;
    birthDate: string;
    sex: string;
    address: string;
    city: string;
    state: string;
    profileComplete: boolean;
  }): Promise<AppUserRecord>;
  updateAuthMetadata(params: {
    authUserId: string;
    fullName: string;
    role: string;
  }): Promise<void>;
};

export type UpdateMyProfileCommand = {
  requestId: string;
  authenticatedUser: AuthenticatedUser;
  input: UpdateMyProfileInput;
  repository: UpdateMyProfileRepository;
};
