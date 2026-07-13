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

export type DeactivateAccountInput = {
  confirmation: 'DEACTIVATE_MY_ACCOUNT';
};

export type DeactivateAccountResult = {
  deactivated: boolean;
  appUser: AppUserRecord;
};

export type DeactivateAccountSuccessResponse = ApiSuccess<DeactivateAccountResult>;
export type ErrorResponse = ApiErrorResponse;

export type DeactivateAccountRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  hasActiveCareRelationship(appUser: AppUserRecord): Promise<boolean>;
  deactivateAppUser(appUserId: string): Promise<AppUserRecord>;
  disableProfessionalDuty(appUserId: string): Promise<void>;
  writeAudit(input: { appUser: AppUserRecord; requestId: string }): Promise<void>;
  revokeAccessToken(accessToken: string): Promise<void>;
};

export type DeactivateAccountCommand = {
  requestId: string;
  authenticatedUser: AuthenticatedUser;
  accessToken: string;
  input: DeactivateAccountInput;
  repository: DeactivateAccountRepository;
};
