export type SetProfessionalDutyInput = {
  isOnDuty: boolean;
};

export type SetProfessionalDutyResult = {
  professionalId: string;
  publicProfileId: string | null;
  isOnDuty: boolean;
};

export type ProfessionalDutyProfile = {
  professionalId: string;
  status: string;
  specialty: string;
  publicProfileId: string | null;
  publicStatus: string | null;
};

export type SetProfessionalDutyRepository = {
  findProfessionalDutyProfileByAppUserId(appUserId: string): Promise<ProfessionalDutyProfile | null>;
  updateProfessionalDuty(params: { professionalId: string; isOnDuty: boolean }): Promise<void>;
  updatePublicDuty(params: { publicProfileId: string; isOnDuty: boolean }): Promise<void>;
};

export type SetProfessionalDutyCommand = {
  requestId: string;
  input: SetProfessionalDutyInput;
  authenticatedUser: { authUserId: string; email: string | null };
};

