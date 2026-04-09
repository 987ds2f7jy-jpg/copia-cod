import { findAppUserByAuthUserId } from '../_shared/appUsers.ts';
import { AppError } from '../_shared/errors.ts';
import { createServiceRoleClient } from '../_shared/supabase.ts';
import type { UploadPublicFileCommand, UploadPublicFileResult } from './types.ts';

const BUCKET_NAME = 'uploads';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FOLDERS = new Set([
  'public',
  'renovacao_receitas',
  'laudos/documento_identidade',
  'laudos/exames',
  'laudos/relatorios',
  'professionals/diplomas',
  'professionals/photos',
  'professionals/gallery',
]);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp']);

function normalizeFolder(folder: string) {
  return folder.trim().replace(/^\/+|\/+$/g, '');
}

function sanitizeExtension(fileName: string) {
  const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : '';

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new AppError({
      status: 422,
      code: 'UPLOAD_EXTENSION_INVALID',
      message: 'Unsupported file extension.',
    });
  }

  return extension;
}

function ensureAllowedFile(file: File) {
  if (!file || typeof file.size !== 'number') {
    throw new AppError({
      status: 400,
      code: 'UPLOAD_FILE_REQUIRED',
      message: 'A file is required.',
    });
  }

  if (file.size <= 0) {
    throw new AppError({
      status: 400,
      code: 'UPLOAD_FILE_EMPTY',
      message: 'Uploaded file is empty.',
    });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new AppError({
      status: 422,
      code: 'UPLOAD_FILE_TOO_LARGE',
      message: 'Uploaded file exceeds the 10MB limit.',
    });
  }

  const contentType = file.type?.trim().toLowerCase() || '';

  if (contentType && !ALLOWED_MIME_TYPES.has(contentType)) {
    throw new AppError({
      status: 422,
      code: 'UPLOAD_CONTENT_TYPE_INVALID',
      message: 'Unsupported file type.',
    });
  }
}

export async function uploadPublicFile({
  requestId,
  folder,
  file,
  authenticatedUser,
}: UploadPublicFileCommand): Promise<UploadPublicFileResult> {
  const normalizedFolder = normalizeFolder(folder);

  if (!ALLOWED_FOLDERS.has(normalizedFolder)) {
    throw new AppError({
      status: 400,
      code: 'UPLOAD_FOLDER_INVALID',
      message: 'Invalid upload folder.',
    });
  }

  ensureAllowedFile(file);

  const client = createServiceRoleClient();
  const appUser = await findAppUserByAuthUserId(client, authenticatedUser.authUserId);
  const ownerSegment = appUser?.id || authenticatedUser.authUserId;
  const extension = sanitizeExtension(file.name || 'file');
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const filePath = `${normalizedFolder}/${ownerSegment}/${Date.now()}_${randomSuffix}.${extension}`;

  console.info('[upload-public-file] request:start', {
    requestId,
    folder: normalizedFolder,
    ownerSegment,
    originalName: file.name,
    size: file.size,
  });

  const { error: uploadError } = await client.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    throw new AppError({
      status: 500,
      code: 'UPLOAD_FAILED',
      message: 'Unable to upload file.',
      details: uploadError.message,
    });
  }

  const { data } = client.storage.from(BUCKET_NAME).getPublicUrl(filePath);

  console.info('[upload-public-file] request:success', {
    requestId,
    path: filePath,
  });

  return {
    file: {
      path: filePath,
      publicUrl: data.publicUrl,
      originalName: file.name || 'file',
      contentType: file.type || '',
      size: file.size,
    },
  };
}
