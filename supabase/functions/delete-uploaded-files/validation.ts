import { AppError } from '../_shared/errors.ts';
import type { DeleteUploadedFilesInput } from './types.ts';

export function parseDeleteUploadedFilesInput(body: unknown): DeleteUploadedFilesInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const rawPaths = record.paths;

  if (!Array.isArray(rawPaths)) {
    throw new AppError({
      status: 400,
      code: 'UPLOAD_PATHS_REQUIRED',
      message: '"paths" must be an array of file paths.',
    });
  }

  const paths = rawPaths
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);

  if (paths.length === 0) {
    throw new AppError({
      status: 400,
      code: 'UPLOAD_PATHS_REQUIRED',
      message: 'At least one file path is required.',
    });
  }

  return { paths };
}
