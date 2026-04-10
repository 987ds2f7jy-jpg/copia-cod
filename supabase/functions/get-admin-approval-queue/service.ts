import type {
  GetAdminApprovalQueueCommand,
  GetAdminApprovalQueueRepository,
  GetAdminApprovalQueueResult,
} from './types.ts';

export async function getAdminApprovalQueue({
  requestId,
  input,
  authenticatedUser,
  repository,
}: {
  repository: GetAdminApprovalQueueRepository;
} & GetAdminApprovalQueueCommand): Promise<GetAdminApprovalQueueResult> {
  const limit = input.limit ?? 100;
  const status = input.status && input.status !== 'all' ? input.status : null;

  console.info('[get-admin-approval-queue] request:start', {
    requestId,
    authUserId: authenticatedUser.authUserId,
    status: status || 'all',
    limit,
  });

  const [publicProfiles, privateProfiles] = await Promise.all([
    repository.listPublicProfiles({ status, limit }),
    repository.listPrivateProfiles({ limit: 200 }),
  ]);

  return { publicProfiles, privateProfiles };
}

