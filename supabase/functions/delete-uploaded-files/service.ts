import { findAppUserByAuthUserId } from '../_shared/appUsers.ts';
import { AppError } from '../_shared/errors.ts';
import { createServiceRoleClient } from '../_shared/supabase.ts';
import type { DeleteUploadedFilesCommand, DeleteUploadedFilesResult } from './types.ts';

const BUCKET_NAME = 'uploads';
const ALLOWED_PREFIXES = [
  'public/',
  'renovacao_receitas/',
  'laudos/documento_identidade/',
  'laudos/exames/',
  'laudos/relatorios/',
  'professionals/diplomas/',
  'professionals/photos/',
  'professionals/gallery/',
];

function isOwnedUploadPath(path: string, ownerSegment: string) {
  if (!path || path.startsWith('/') || path.includes('\\')) {
    return false;
  }

  const segments = path.split('/');
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return false;
  }

  return ALLOWED_PREFIXES.some((prefix) => path.startsWith(`${prefix}${ownerSegment}/`));
}

export async function deleteUploadedFiles({
  requestId,
  input,
  authenticatedUser,
}: DeleteUploadedFilesCommand): Promise<DeleteUploadedFilesResult> {
  const client = createServiceRoleClient();
  const appUser = await findAppUserByAuthUserId(client, authenticatedUser.authUserId);

  if (!appUser?.id || appUser.isActive === false) {
    throw new AppError({
      status: 403,
      code: 'APP_USER_NOT_AUTHORIZED',
      message: 'An active application user is required to delete uploaded files.',
    });
  }

  const ownerSegment = appUser.id;
  const normalizedPaths = [...new Set(input.paths.map((path) => path.trim()).filter(Boolean))];

  const invalidPath = normalizedPaths.find((path) => !isOwnedUploadPath(path, ownerSegment));

  if (invalidPath) {
    throw new AppError({
      status: 403,
      code: 'UPLOAD_DELETE_FORBIDDEN',
      message: 'One or more files do not belong to the authenticated user.',
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
