import { AppError } from './errors.ts';

type NormalizeUploadPathOptions = {
  allowedPrefixes: string[];
  fieldName: string;
};

function toStringValue(value: unknown) {
  return String(value ?? '').trim();
}

function extractUploadPath(value: string) {
  if (!/^https?:\/\//i.test(value)) {
    return value.replace(/^\/+/, '');
  }

  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/uploads\/(.+)$/);
    return match?.[1] ? decodeURIComponent(match[1]).replace(/^\/+/, '') : '';
  } catch {
    return '';
  }
}

export function normalizeUploadPath(value: unknown, options: NormalizeUploadPathOptions) {
  const rawValue = toStringValue(value);

  if (!rawValue) {
    return '';
  }

  const path = extractUploadPath(rawValue);
  const isAllowed = options.allowedPrefixes.some((prefix) => path.startsWith(prefix));

  if (!path || !isAllowed || /^https?:\/\//i.test(path)) {
    throw new AppError({
      status: 422,
      code: 'UPLOAD_PATH_INVALID',
      message: `${options.fieldName} must reference a private uploaded file path.`,
      details: { fieldName: options.fieldName },
    });
  }

  return path;
}

export function normalizeUploadPathList(value: unknown, options: NormalizeUploadPathOptions) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeUploadPath(item, options))
    .filter(Boolean);
}
