import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getBackofficeMe, loginBackoffice } from '../api/auth';
import { clearBackofficeSession, getStoredBackofficeSession, saveBackofficeSession } from '../api/session';
import type { BackofficeAdmin, BackofficeSession } from '../types';

type BackofficeAuthContextValue = {
  admin: BackofficeAdmin | null;
  session: BackofficeSession | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  validateSession: () => Promise<boolean>;
  logout: () => void;
};

const BackofficeAuthContext = createContext<BackofficeAuthContextValue | null>(null);

export function BackofficeAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<BackofficeSession | null>(() => getStoredBackofficeSession());
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearBackofficeSession();
    setSession(null);
  }, []);

  const validateSession = useCallback(async () => {
    const stored = getStoredBackofficeSession();
    if (!stored || stored.expiresAt * 1000 <= Date.now()) {
      logout();
      return false;
    }
    try {
      const { admin } = await getBackofficeMe();
      const nextSession = saveBackofficeSession({ ...stored, admin });
      setSession(nextSession);
      return true;
    } catch {
      logout();
      return false;
    }
  }, [logout]);

  useEffect(() => {
    validateSession().finally(() => setLoading(false));
  }, [validateSession]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginBackoffice(email, password);
    const nextSession = saveBackofficeSession({ ...result.session, admin: result.admin });
    setSession(nextSession);
  }, []);

  const value = useMemo(() => ({
    admin: session?.admin || null,
    session,
    loading,
    login,
    validateSession,
    logout,
  }), [loading, login, logout, session, validateSession]);

  return <BackofficeAuthContext.Provider value={value}>{children}</BackofficeAuthContext.Provider>;
}

export function useBackofficeAuth() {
  const context = useContext(BackofficeAuthContext);
  if (!context) throw new Error('useBackofficeAuth must be used inside BackofficeAuthProvider.');
  return context;
}
