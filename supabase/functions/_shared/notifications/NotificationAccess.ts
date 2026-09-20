import { AppError } from '../errors.ts';
import { requireActiveSessionAccount } from '../sessionAccount.ts';
import { createServiceRoleClient } from '../supabase.ts';

export async function requireNotificationEndUser(req: Request) {
  const client = createServiceRoleClient();
  const account = await requireActiveSessionAccount(req, client);
  if (account.role !== 'patient' && account.role !== 'professional') {
    throw new AppError({ status: 403, code: 'NOTIFICATIONS_ROLE_FORBIDDEN', message: 'Notifications are available only to end users.' });
  }
  return { client, account };
}
