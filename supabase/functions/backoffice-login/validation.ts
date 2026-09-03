import { AppError } from '../_shared/errors.ts';
import { normalizeAdminEmail } from '../_shared/backofficeAuth.ts';

export type BackofficeLoginInput = { email: string; password: string };

export function parseBackofficeLoginInput(body: unknown): BackofficeLoginInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({ status: 400, code: 'INVALID_BODY', message: 'Request body must be an object.' });
  }

  const record = body as Record<string, unknown>;
  const email = normalizeAdminEmail(record.email);
  const password = String(record.password ?? '');
  if (!email || !email.includes('@') || email.length > 320) {
    throw new AppError({ status: 422, code: 'ADMIN_EMAIL_INVALID', message: 'A valid administrative email is required.' });
  }
  if (!password || password.length > 1024) {
    throw new AppError({ status: 422, code: 'ADMIN_PASSWORD_INVALID', message: 'A valid administrative password is required.' });
  }
  return { email, password };
}
