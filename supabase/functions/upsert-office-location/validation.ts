import { AppError } from '../_shared/errors.ts';
import type { OfficeLocationInput } from './types.ts';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toTrimmed(value: unknown) {
  return String(value ?? '').trim();
}

function toOptionalTrimmed(value: unknown) {
  const v = toTrimmed(value);
  return v ? v : undefined;
}

function toNumber(value: unknown, field: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new AppError({
      status: 422,
      code: 'NUMBER_INVALID',
      message: `"${field}" must be a valid number.`,
      details: { value },
    });
  }
  return n;
}

export function parseOfficeLocationInput(body: unknown): OfficeLocationInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const professionalPublicProfileId = toTrimmed(record.professionalPublicProfileId);

  if (!UUID_REGEX.test(professionalPublicProfileId)) {
    throw new AppError({
      status: 400,
      code: 'PUBLIC_PROFILE_ID_INVALID',
      message: '"professionalPublicProfileId" must be a valid UUID.',
    });
  }

  const action = (toTrimmed(record.action) as 'upsert' | 'delete' | 'get') || 'upsert';

  if (action === 'delete' || action === 'get') {
    return {
      professionalPublicProfileId,
      action,
      location: null,
    };
  }

  const locationValue = record.location;
  if (!locationValue || typeof locationValue !== 'object') {
    throw new AppError({
      status: 400,
      code: 'LOCATION_REQUIRED',
      message: '"location" is required for upsert.',
    });
  }

  const location = locationValue as Record<string, unknown>;
  const addressLine = toTrimmed(location.addressLine);
  const city = toTrimmed(location.city);
  const state = toTrimmed(location.state).toUpperCase();
  const latitude = toNumber(location.latitude, 'latitude');
  const longitude = toNumber(location.longitude, 'longitude');

  if (!addressLine || !city || !state) {
    throw new AppError({
      status: 422,
      code: 'ADDRESS_INVALID',
      message: 'Rua, cidade e UF são obrigatórios.',
    });
  }

  if (!latitude || !longitude) {
    throw new AppError({
      status: 422,
      code: 'COORDINATES_REQUIRED',
      message: 'Latitude e longitude são obrigatórios.',
    });
  }

  return {
    professionalPublicProfileId,
    action,
    location: {
      addressLine,
      number: toOptionalTrimmed(location.number),
      complement: toOptionalTrimmed(location.complement),
      neighborhood: toOptionalTrimmed(location.neighborhood),
      city,
      state,
      postalCode: toOptionalTrimmed(location.postalCode),
      formattedAddress: toOptionalTrimmed(location.formattedAddress),
      latitude,
      longitude,
      mapboxPlaceId: toOptionalTrimmed(location.mapboxPlaceId),
    },
  };
}

