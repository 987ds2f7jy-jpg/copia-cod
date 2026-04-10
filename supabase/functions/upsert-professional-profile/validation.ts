import { AppError } from '../_shared/errors.ts';
import type { UpsertProfessionalProfileInput } from './types.ts';

function toTrimmedString(value: unknown) {
  return String(value ?? '').trim();
}

function toOptionalUrl(value: unknown) {
  const url = toTrimmedString(value);
  return url ? url : undefined;
}

function toOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new AppError({
      status: 422,
      code: 'NUMBER_INVALID',
      message: 'A numeric field is invalid.',
      details: { value },
    });
  }
  return n;
}

function toOptionalBoolean(value: unknown) {
  if (value === undefined) {
    return undefined;
  }
  return Boolean(value);
}

function toOptionalStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.map((v) => toTrimmedString(v)).filter(Boolean);
}

export function parseUpsertProfessionalProfileInput(body: unknown): UpsertProfessionalProfileInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;

  return {
    bio: toTrimmedString(record.bio) || undefined,
    photoUrl: toOptionalUrl(record.photoUrl),
    priceStandard: toOptionalNumber(record.priceStandard),
    pricePriority: toOptionalNumber(record.pricePriority),
    availableDays: toOptionalStringArray(record.availableDays),
    availableHours: toOptionalStringArray(record.availableHours),
    perfilAtivo: toOptionalBoolean(record.perfilAtivo),
    prioritarioAtivo: toOptionalBoolean(record.prioritarioAtivo),

    instagramUrl: toOptionalUrl(record.instagramUrl),
    tags: toOptionalStringArray(record.tags),
    patientTypes: toOptionalStringArray(record.patientTypes),
    modality: toTrimmedString(record.modality) || undefined,
    officeCity: toTrimmedString(record.officeCity) || undefined,
    officeState: toTrimmedString(record.officeState) || undefined,
    officeAddress: toTrimmedString(record.officeAddress) || undefined,
    galleryUrls: toOptionalStringArray(record.galleryUrls),
  };
}

