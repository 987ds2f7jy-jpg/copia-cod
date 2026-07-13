import { AppError } from '../_shared/errors.ts';
import type { BootstrapAppUserInput, BootstrapRole } from './types.ts';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeOptionalString(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeRole(value: unknown): BootstrapRole | null {
  const normalized = normalizeOptionalString(value).toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized === 'patient' || normalized === 'professional') {
    return normalized;
  }

  throw new AppError({
    status: 400,
    code: 'ROLE_INVALID',
    message: '"role" must be either "patient" or "professional".',
  });
}

export function parseBootstrapAppUserInput(body: unknown): BootstrapAppUserInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const email = normalizeOptionalString(record.email).toLowerCase();
  const password = normalizeOptionalString(record.password);
  const fullName = normalizeOptionalString(record.fullName ?? record.full_name);
  const phone = normalizeOptionalString(record.phone);
  const cpf = normalizeOptionalString(record.cpf);
  const birthDate = normalizeOptionalString(record.birthDate ?? record.birth_date);
  const sex = normalizeOptionalString(record.sex);
  const address = normalizeOptionalString(record.address);
  const city = normalizeOptionalString(record.city);
  const state = normalizeOptionalString(record.state).toUpperCase();
  const role = normalizeRole(record.role);
  const termsAccepted = record.termsAccepted === true;
  const privacyAcknowledged = record.privacyAcknowledged === true;

  if ((email && !password) || (!email && password)) {
    throw new AppError({
      status: 400,
      code: 'SIGNUP_CREDENTIALS_INCOMPLETE',
      message: '"email" and "password" must be sent together for signup bootstrap.',
    });
  }

  if (email && !EMAIL_REGEX.test(email)) {
    throw new AppError({
      status: 400,
      code: 'EMAIL_INVALID',
      message: '"email" must be a valid email address.',
    });
  }

  if (password && password.length < 6) {
    throw new AppError({
      status: 400,
      code: 'PASSWORD_INVALID',
      message: '"password" must be at least 6 characters long.',
    });
  }

  return {
    email: email || null,
    password: password || null,
    fullName: fullName || null,
    role,
    phone,
    cpf,
    birthDate,
    sex,
    address,
    city,
    state,
    termsAccepted,
    privacyAcknowledged,
  };
}
