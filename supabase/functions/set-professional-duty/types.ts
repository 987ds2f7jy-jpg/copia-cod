export type SetProfessionalDutyInput = {
  isOnDuty: boolean;
};

export type SetProfessionalDutyResult = {
  professionalId: string;
  publicProfileId: string | null;
  isOnDuty: boolean;
};

export type SetProfessionalDutyRepository = {
  findProfessionalProfileIdByAppUserId(appUserId: string): Promise<string | null>;
  findPublicProfileIdByProfessionalId(professionalId: string): Promise<string | null>;
  updateProfessionalDuty(params: { professionalId: string; isOnDuty: boolean }): Promise<void>;
  updatePublicDuty(params: { publicProfileId: string; isOnDuty: boolean }): Promise<void>;
};

export type SetProfessionalDutyCommand = {
  requestId: string;
  input: SetProfessionalDutyInput;
  authenticatedUser: { authUserId: string; email: string | null };
};

