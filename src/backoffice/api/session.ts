import type { BackofficeSession } from '../types';

export const BACKOFFICE_SESSION_STORAGE_KEY = 'rd.backoffice.session.v1';

function parseSession(value: string | null): BackofficeSession | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as BackofficeSession;
    if (!parsed?.accessToken || !parsed?.admin?.id || !parsed?.admin?.email || !Number.isFinite(Number(parsed.expiresAt))) return null;
    return { ...parsed, expiresAt: Number(parsed.expiresAt) };
  } catch {
    return null;
  }
}

export function getStoredBackofficeSession() {
  if (typeof window === 'undefined') return null;
  return parseSession(window.localStorage.getItem(BACKOFFICE_SESSION_STORAGE_KEY));
}

export function saveBackofficeSession(session: BackofficeSession) {
  window.localStorage.setItem(BACKOFFICE_SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function clearBackofficeSession() {
  if (typeof window !== 'undefined') window.localStorage.removeItem(BACKOFFICE_SESSION_STORAGE_KEY);
}
