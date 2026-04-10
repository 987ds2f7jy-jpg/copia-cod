export type ReviewProfessionalApplicationInput = {
  publicProfileId: string;
  action: 'approve' | 'reject' | 'suspend';
};

export type ReviewProfessionalApplicationResult = {
  publicProfileId: string;
  privateProfileId: string | null;
  publicStatus: string;
  privateStatus: string | null;
  isOnDuty: boolean;
};

export type ReviewProfessionalApplicationRepository = {
  findPublicProfileById(publicProfileId: string): Promise<{ id: string; professional_profile_id: string } | null>;
  updatePublicProfile(params: { publicProfileId: string; updates: Record<string, unknown> }): Promise<void>;
  updatePrivateProfile(params: { professionalId: string; updates: Record<string, unknown> }): Promise<void>;
};

export type ReviewProfessionalApplicationCommand = {
  requestId: string;
  input: ReviewProfessionalApplicationInput;
  authenticatedUser: { authUserId: string; email: string | null };
};

