import { findAppUserByAuthUserId } from '../_shared/appUsers.ts';
import { AppError } from '../_shared/errors.ts';
import { createServiceRoleClient } from '../_shared/supabase.ts';
import type { DeleteUploadedFilesCommand, DeleteUploadedFilesResult } from './types.ts';

const BUCKET_NAME = 'uploads';

export async function deleteUploadedFiles({
  requestId,
  input,
  authenticatedUser,
}: DeleteUploadedFilesCommand): Promise<DeleteUploadedFilesResult> {
  const client = createServiceRoleClient();
  const appUser = await findAppUserByAuthUserId(client, authenticatedUser.authUserId);
  const ownerSegment = appUser?.id || authenticatedUser.authUserId;
  const normalizedPaths = [...new Set(input.paths.map((path) => path.trim()).filter(Boolean))];

  const invalidPath = normalizedPaths.find((path) => !path.includes(`/${ownerSegment}/`));

  if (invalidPath) {
    throw new AppError({
      status: 403,
      code: 'UPLOAD_DELETE_FORBIDDEN',
      message: 'One or more files do not belong to the authenticated user.',
      details: invalidPath,
    });
  }

  console.info('[delete-uploaded-files] request:start', {
    requestId,
    ownerSegment,
    totalPaths: normalizedPaths.length,
  });

  const { data, error } = await client.storage
    .from(BUCKET_NAME)
    .remove(normalizedPaths);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'UPLOAD_DELETE_FAILED',
      message: 'Unable to delete uploaded files.',
      details: error.message,
    });
  }

  const deletedPaths = Array.isArray(data)
    ? data.map((entry) => String(entry?.name || '').trim()).filter(Boolean)
    : normalizedPaths;

  console.info('[delete-uploaded-files] request:success', {
    requestId,
    deletedPaths: deletedPaths.length,
  });

  return {
    deletedPaths: deletedPaths.length > 0 ? deletedPaths : normalizedPaths,
  };
}
