import type { BackofficeAdmin, BackofficeSession } from '../types';
import { invokeBackofficeFunction } from './client';

export async function loginBackoffice(email: string, password: string) {
  return invokeBackofficeFunction<{ admin: BackofficeAdmin; session: Omit<BackofficeSession, 'admin'> }>(
    'backoffice-login',
    { email, password },
    undefined,
  );
}

export async function getBackofficeMe() {
  return invokeBackofficeFunction<{ admin: BackofficeAdmin }>('backoffice-me');
}
