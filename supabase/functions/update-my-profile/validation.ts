import { AppError } from '../_shared/errors.ts';
import type { UpdateMyProfileInput } from './types.ts';

function normalizeOptionalString(value: unknown) {
  return String(value ?? '').trim();
}

export function parseUpdateMyProfileInput(body: unknown): UpdateMyProfileInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const input: UpdateMyProfileInput = {};

  if (Object.prototype.hasOwnProperty.call(record, 'fullName')
    || Object.prototype.hasOwnProperty.call(record, 'full_name')) {
    input.fullName = normalizeOptionalString(record.fullName ?? record.full_name);
  }

  if (Object.prototype.hasOwnProperty.call(record, 'phone')) {
    input.phone = normalizeOptionalString(record.phone);
  }

  if (Object.prototype.hasOwnProperty.call(record, 'cpf')) {
    input.cpf = normalizeOptionalString(record.cpf);
  }

  if (Object.prototype.hasOwnProperty.call(record, 'birthDate')
    || Object.prototype.hasOwnProperty.call(record, 'birth_date')) {
    input.birthDate = normalizeOptionalString(record.birthDate ?? record.birth_date);
  }

  if (Object.prototype.hasOwnProperty.call(record, 'sex')) {
    input.sex = normalizeOptionalString(record.sex);
  }

  if (Object.prototype.hasOwnProperty.call(record, 'address')) {
    input.address = normalizeOptionalString(record.address);
  }

  if (Object.prototype.hasOwnProperty.call(record, 'city')) {
    input.city = normalizeOptionalString(record.city);
  }

  if (Object.prototype.hasOwnProperty.call(record, 'state')) {
    input.state = normalizeOptionalString(record.state).toUpperCase();
  }

  if (Object.keys(input).length === 0) {
    throw new AppError({
      status: 400,
      code: 'PROFILE_UPDATE_EMPTY',
      message: 'At least one profile field must be sent.',
    });
  }

  return input;
}
