import { isActiveAccount } from '../shared/status';

export type AccountRecord = {
  id: string;
  authUserId: string;
  role: string;
  isActive: boolean;
};

export function assertActiveAccount(account: AccountRecord | null) {
  if (!account?.id) {
    throw new Error('ACCOUNT_NOT_FOUND');
  }
  if (!isActiveAccount(account.isActive)) {
    throw new Error('ACCOUNT_INACTIVE');
  }
  return account;
}
