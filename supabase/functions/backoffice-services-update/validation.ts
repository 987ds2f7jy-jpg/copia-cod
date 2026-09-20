import { AppError } from '../_shared/errors.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_FIELDS = new Set(['servicePriceId', 'grossPrice', 'active']);
const MAX_GROSS_PRICE = 9_999_999_999.99;

export type BackofficeServicesUpdateInput = {
  servicePriceId: string;
  grossPrice: number;
  active: boolean;
};

export function parseBackofficeServicesUpdateInput(body: unknown): BackofficeServicesUpdateInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({ status: 400, code: 'INVALID_BODY', message: 'Request body must be an object.' });
  }

  const record = body as Record<string, unknown>;
  const unexpectedFields = Object.keys(record).filter((field) => !ALLOWED_FIELDS.has(field));
  if (unexpectedFields.length > 0) {
    throw new AppError({
      status: 400,
      code: 'SERVICE_PRICE_FIELDS_INVALID',
      message: 'Request contains unsupported service price fields.',
      details: { allowedFields: [...ALLOWED_FIELDS] },
    });
  }

  const servicePriceId = String(record.servicePriceId ?? '').trim();
  if (!UUID_REGEX.test(servicePriceId)) {
    throw new AppError({
      status: 400,
      code: 'SERVICE_PRICE_ID_INVALID',
      message: 'servicePriceId must be a valid UUID.',
    });
  }

  if (typeof record.grossPrice !== 'number' || !Number.isFinite(record.grossPrice)) {
    throw new AppError({
      status: 400,
      code: 'SERVICE_PRICE_VALUE_INVALID',
      message: 'grossPrice must be a finite number.',
    });
  }

  const cents = record.grossPrice * 100;
  if (
    record.grossPrice < 0
    || record.grossPrice > MAX_GROSS_PRICE
    || Math.abs(cents - Math.round(cents)) > 1e-8
  ) {
    throw new AppError({
      status: 400,
      code: 'SERVICE_PRICE_VALUE_INVALID',
      message: 'grossPrice must be a non-negative BRL amount with at most two decimal places.',
    });
  }

  if (typeof record.active !== 'boolean') {
    throw new AppError({
      status: 400,
      code: 'SERVICE_PRICE_ACTIVE_INVALID',
      message: 'active must be a boolean.',
    });
  }

  return {
    servicePriceId,
    grossPrice: record.grossPrice,
    active: record.active,
  };
}
