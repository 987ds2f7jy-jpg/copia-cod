import { requireAuthenticatedUser } from '../_shared/auth.ts';
import {
  createRequestId,
  ensureMethod,
  errorResponse,
  handlePreflight,
  successResponse,
} from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { createServiceRoleClient, createSupabaseAuthUserLookup } from '../_shared/supabase.ts';
import { findAppUserByAuthUserId } from '../_shared/appUsers.ts';
import { AppError } from '../_shared/errors.ts';

const FUNCTION_NAME = 'upload-file';
const CORS: CorsOptions = {
  allowedMethods: ['POST'],
};
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
const MIME_TYPES_BY_EXTENSION: Record<string, Set<string>> = {
  pdf: new Set(['application/pdf']),
  jpg: new Set(['image/jpeg']),
  jpeg: new Set(['image/jpeg']),
  png: new Set(['image/png']),
  webp: new Set(['image/webp']),
};
const MEDICAL_FOLDERS = new Set([
  'renovacao_receitas',
  'laudos/documento_identidade',
  'laudos/exames',
  'laudos/relatorios',
]);

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

function ensureAllowedFile(file: File, extension: string) {
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

  if (!contentType || !ALLOWED_MIME_TYPES.has(contentType)) {
    throw new AppError({
      status: 422,
      code: 'UPLOAD_CONTENT_TYPE_INVALID',
      message: 'Unsupported file type.',
    });
  }

  if (!MIME_TYPES_BY_EXTENSION[extension]?.has(contentType)) {
    throw new AppError({
      status: 422,
      code: 'UPLOAD_MIME_EXTENSION_MISMATCH',
      message: 'File extension does not match its declared content type.',
    });
  }
}

function assertFolderAllowedForRole(folder: string, role: string) {
  if (MEDICAL_FOLDERS.has(folder) && role !== 'patient') {
    throw new AppError({
      status: 403,
      code: 'UPLOAD_FOLDER_FORBIDDEN',
      message: 'This upload folder is restricted to patient medical flows.',
    });
  }

  if (folder.startsWith('professionals/') && role !== 'patient' && role !== 'professional') {
    throw new AppError({
      status: 403,
      code: 'UPLOAD_FOLDER_FORBIDDEN',
      message: 'This upload folder is restricted to professional onboarding and profiles.',
    });
  }
}

async function handleUploadFileRequest(req: Request) {
  const preflightResponse = handlePreflight(req, CORS);

  if (preflightResponse) {
    return preflightResponse;
  }

  const requestId = createRequestId();
  const methodErrorResponse = ensureMethod(req, {
    allowedMethods: ['POST'],
    functionName: FUNCTION_NAME,
    requestId,
    cors: CORS,
  });

  if (methodErrorResponse) {
    return methodErrorResponse;
  }

  try {
    const client = createServiceRoleClient();
    const authenticatedUser = await requireAuthenticatedUser(req, createSupabaseAuthUserLookup(client));
    const formData = await req.formData();
    const folder = normalizeFolder(String(formData.get('folder') || 'public'));
    const file = formData.get('file');

    if (!(file instanceof File)) {
      throw new AppError({
        status: 400,
        code: 'UPLOAD_FILE_REQUIRED',
        message: 'A file is required.',
      });
    }

    if (!ALLOWED_FOLDERS.has(folder)) {
      throw new AppError({
        status: 400,
        code: 'UPLOAD_FOLDER_INVALID',
        message: 'Invalid upload folder.',
      });
    }

    const appUser = await findAppUserByAuthUserId(client, authenticatedUser.authUserId);

    if (!appUser?.id || appUser.isActive === false) {
      throw new AppError({
        status: 403,
        code: 'APP_USER_NOT_AUTHORIZED',
        message: 'An active application user is required to upload files.',
      });
    }

    assertFolderAllowedForRole(folder, appUser.role);

    const ownerSegment = appUser.id;
    const extension = sanitizeExtension(file.name || 'file');
    ensureAllowedFile(file, extension);
    const randomSuffix = crypto.randomUUID().slice(0, 8);
    const filePath = `${folder}/${ownerSegment}/${Date.now()}_${randomSuffix}.${extension}`;

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

    const { data: signedData, error: signedError } = await client.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 5 * 60);

    if (signedError) {
      throw new AppError({
        status: 500,
        code: 'UPLOAD_SIGNED_URL_FAILED',
        message: 'Unable to create signed file URL.',
        details: signedError.message,
      });
    }

    return successResponse({
      file: {
        path: filePath,
        signedUrl: signedData?.signedUrl || '',
        publicUrl: '',
        originalName: file.name || 'file',
        contentType: file.type || '',
        size: file.size,
      },
    }, requestId, {
      status: 200,
      cors: CORS,
    });
  } catch (error) {
    return errorResponse(error, {
      requestId,
      functionName: FUNCTION_NAME,
      cors: CORS,
    });
  }
}

Deno.serve(handleUploadFileRequest);
