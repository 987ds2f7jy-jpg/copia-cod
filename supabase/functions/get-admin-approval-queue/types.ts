export type GetAdminApprovalQueueInput = {
  status?: string;
  limit?: number;
};

export type AdminPublicProfile = Record<string, unknown>;
export type AdminPrivateProfile = Record<string, unknown>;

export type GetAdminApprovalQueueResult = {
  publicProfiles: AdminPublicProfile[];
  privateProfiles: AdminPrivateProfile[];
};

export type GetAdminApprovalQueueRepository = {
  listPublicProfiles(params: { status: string | null; limit: number }): Promise<AdminPublicProfile[]>;
  listPrivateProfiles(params: { limit: number }): Promise<AdminPrivateProfile[]>;
};

export type GetAdminApprovalQueueCommand = {
  requestId: string;
  input: GetAdminApprovalQueueInput;
  authenticatedUser: { authUserId: string; email: string | null };
};

