import { requireAuthenticatedUser } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import {
  createRequestId,
  ensureMethod,
  errorResponse,
  handlePreflight,
  successResponse,
} from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { createServiceRoleClient, createSupabaseAuthUserLookup } from '../_shared/supabase.ts';
import { uploadPublicFile } from './service.ts';

const FUNCTION_NAME = 'upload-public-file';
const CORS: CorsOptions = {
  allowedMethods: ['POST'],
};

export async function handleUploadPublicFileRequest(req: Request) {
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
    const folder = String(formData.get('folder') || '').trim();
    const fileValue = formData.get('file');

    if (!(fileValue instanceof File)) {
      throw new AppError({
        status: 400,
        code: 'UPLOAD_FILE_REQUIRED',
        message: 'FormData "file" is required.',
      });
    }

    const result = await uploadPublicFile({
      requestId,
      folder,
      file: fileValue,
      authenticatedUser,
    });

    return successResponse(result, requestId, {
      status: 201,
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
