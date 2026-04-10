const STORAGE_KEY = 'rd.auth.session.v1';

const listeners = new Set();

function notifyListeners(session) {
  listeners.forEach((listener) => {
    try {
      listener(session);
    } catch {
      // Session listeners must never break auth state propagation.
    }
  });
}

function normalizeSession(session) {
  if (!session || typeof session !== 'object') {
    return null;
  }

  const accessToken = String(session.accessToken || session.access_token || '').trim();
  const refreshToken = String(session.refreshToken || session.refresh_token || '').trim();

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: Number(session.expiresAt ?? session.expires_at ?? 0) || null,
    expiresIn: Number(session.expiresIn ?? session.expires_in ?? 0) || null,
    tokenType: String(session.tokenType || session.token_type || 'bearer').trim() || 'bearer',
  };
}

export function getStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    return normalizeSession(JSON.parse(storedValue));
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveStoredSession(session) {
  if (typeof window === 'undefined') {
    return null;
  }

  const normalizedSession = normalizeSession(session);

  if (!normalizedSession) {
    clearStoredSession();
    return null;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedSession));
  notifyListeners(normalizedSession);
  return normalizedSession;
}

export function clearStoredSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  notifyListeners(null);
}

export function subscribeToSessionChanges(listener) {
  listeners.add(listener);

  const onStorage = (event) => {
    if (event.key === STORAGE_KEY) {
      listener(getStoredSession());
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }

  return () => {
    listeners.delete(listener);

    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}
