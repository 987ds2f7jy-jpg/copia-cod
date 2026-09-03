import { createBackofficeToken, verifyAdminPassword } from '../_shared/backofficeAuth.ts';
import { AppError } from '../_shared/errors.ts';
import type { BackofficeLoginInput } from './validation.ts';
import type { createBackofficeLoginRepository } from './repository.ts';

export async function loginBackofficeAdmin({
  input,
  repository,
}: {
  input: BackofficeLoginInput;
  repository: ReturnType<typeof createBackofficeLoginRepository>;
}) {
  const admin = await repository.findByEmail(input.email);
  const passwordValid = admin ? await verifyAdminPassword(input.password, admin.password_hash) : false;

  // Deliberately return the same response for unknown, inactive, and invalid accounts.
  if (!admin || !admin.is_active || !passwordValid) {
    throw new AppError({ status: 401, code: 'ADMIN_LOGIN_INVALID', message: 'Invalid administrative email or password.' });
  }

  const session = await createBackofficeToken({ id: admin.id, email: admin.email });
  return {
    admin: { id: admin.id, email: admin.email },
    session,
  };
}
