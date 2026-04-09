import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';

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

export type DeactivateAccountInput = Record<string, never>;

export type DeactivateAccountResult = {
  deactivated: boolean;
  appUser: AppUserRecord;
};

export type DeactivateAccountSuccessResponse = ApiSuccess<DeactivateAccountResult>;
export type ErrorResponse = ApiErrorResponse;

export type DeactivateAccountRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  deactivateAppUser(appUserId: string): Promise<AppUserRecord>;
  revokeAccessToken(accessToken: string): Promise<void>;
};

export type DeactivateAccountCommand = {
  requestId: string;
  authenticatedUser: AuthenticatedUser;
  accessToken: string;
  repository: DeactivateAccountRepository;
};
