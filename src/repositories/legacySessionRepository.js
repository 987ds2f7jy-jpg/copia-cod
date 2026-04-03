const SESSION_KEY = 'rd_session_token';
const SESSION_EXPIRY_KEY = 'rd_session_expiry';

export const legacySessionRepository = {
  getToken() {
    return localStorage.getItem(SESSION_KEY);
  },

  getExpiry() {
    return localStorage.getItem(SESSION_EXPIRY_KEY);
  },

  isTokenValid() {
    const token = this.getToken();
    const expiry = this.getExpiry();

    if (!token || !expiry) {
      return false;
    }

    return new Date(expiry) > new Date();
  },

  setSession(token, expiry) {
    localStorage.setItem(SESSION_KEY, token);
    localStorage.setItem(SESSION_EXPIRY_KEY, expiry);
  },

  clearSession() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_EXPIRY_KEY);
  },
};
