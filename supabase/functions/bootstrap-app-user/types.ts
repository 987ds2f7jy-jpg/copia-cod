import type { ApiErrorResponse, ApiSuccess } from '../_shared/types.ts';

export type BootstrapRole = 'patient' | 'professional';
export type BootstrapResolvedRole = BootstrapRole | 'admin';

export type BootstrapAppUserInput = {
  email: string | null;
  password: string | null;
  fullName: string | null;
  role: BootstrapRole | null;
  phone: string;
  cpf: string;
  birthDate: string;
  sex: string;
  address: string;
  city: string;
  state: string;
  termsAccepted: boolean;
  privacyAcknowledged: boolean;
};

export type LegalEventRecord = {
  documentKey: 'terms_of_use' | 'privacy_notice';
  documentVersion: string;
  eventType: 'accepted' | 'acknowledged';
};

export type BootstrapAuthenticatedUser = {
  authUserId: string;
  email: string;
  fullName: string;
  role: BootstrapResolvedRole;
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

export type AppUserUpsertPayload = {
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

export type AuthSessionRecord = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  expiresIn: number | null;
  tokenType: string | null;
};

export type BootstrapAppUserResult = {
  appUser: AppUserRecord;
  session: AuthSessionRecord | null;
  created: boolean;
  legalEvents?: LegalEventRecord[];
};

export type BootstrapAppUserSuccessResponse = ApiSuccess<BootstrapAppUserResult>;
export type ErrorResponse = ApiErrorResponse;

export type BootstrapAuthenticatedUserLookup = (
  accessToken: string,
) => Promise<BootstrapAuthenticatedUser | null>;

export type BootstrapAuthUserRecord = {
  authUserId: string;
  email: string;
};

export type BootstrapAppUserRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  findAppUserByEmail(email: string): Promise<AppUserRecord | null>;
  createAuthUser(params: {
    email: string;
    password: string;
    fullName: string;
    role: BootstrapRole;
  }): Promise<BootstrapAuthUserRecord>;
  deleteAuthUser(authUserId: string): Promise<void>;
  deleteAppUser(appUserId: string): Promise<void>;
  createAppUser(payload: AppUserUpsertPayload): Promise<AppUserRecord>;
  updateAppUser(appUserId: string, payload: AppUserUpsertPayload): Promise<AppUserRecord>;
  recordSignupLegalEvents(params: {
    userId: string;
    role: BootstrapRole;
  }): Promise<LegalEventRecord[]>;
  signInWithPassword(params: {
    email: string;
    password: string;
  }): Promise<AuthSessionRecord>;
};

export type BootstrapAppUserCommand = {
  requestId: string;
  input: BootstrapAppUserInput;
  authenticatedUser: BootstrapAuthenticatedUser | null;
  repository: BootstrapAppUserRepository;
};
