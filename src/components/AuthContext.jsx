import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';

const SESSION_KEY = 'rd_session_token';
const SESSION_EXPIRY_KEY = 'rd_session_expiry';

async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password + 'rd_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function newExpiry() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

function isTokenValid() {
  const token = localStorage.getItem(SESSION_KEY);
  const expiry = localStorage.getItem(SESSION_EXPIRY_KEY);
  if (!token || !expiry) return false;
  return new Date(expiry) > new Date();
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      if (!isTokenValid()) {
        setUser(null);
        setLoading(false);
        return;
      }
      const token = localStorage.getItem(SESSION_KEY);
      const results = await base44.entities.AppUser.filter({ session_token: token });
      if (results && results.length > 0) {
        const appUser = results[0];
        if (appUser.token_expires_at && new Date(appUser.token_expires_at) > new Date()) {
          setUser(appUser);
        } else {
          clearLocalSession();
          setUser(null);
        }
      } else {
        clearLocalSession();
        setUser(null);
      }
    } catch (err) {
      const isAuthError = err?.status === 401 || err?.status === 403;
      if (isAuthError) {
        clearLocalSession();
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const clearLocalSession = () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_EXPIRY_KEY);
  };

  const login = useCallback(async (email, password) => {
    const hash = await hashPassword(password);
    const results = await base44.entities.AppUser.filter({
      email: email.toLowerCase().trim(),
      password_hash: hash,
      is_active: true,
    });
    if (!results || results.length === 0) {
      throw new Error('Email ou senha inválidos.');
    }
    const appUser = results[0];
    const token = generateToken();
    const expires = newExpiry();
    await base44.entities.AppUser.update(appUser.id, {
      session_token: token,
      token_expires_at: expires,
    });
    localStorage.setItem(SESSION_KEY, token);
    localStorage.setItem(SESSION_EXPIRY_KEY, expires);
    const updatedUser = { ...appUser, session_token: token, token_expires_at: expires };
    setUser(updatedUser);
    return updatedUser;
  }, []);

  const register = useCallback(async ({ full_name, email, password, role = 'patient', ...extra }) => {
    const existing = await base44.entities.AppUser.filter({ email: email.toLowerCase().trim() });
    if (existing && existing.length > 0) {
      throw new Error('Este email já está cadastrado.');
    }
    const hash = await hashPassword(password);
    const token = generateToken();
    const expires = newExpiry();
    const newUser = await base44.entities.AppUser.create({
      full_name: full_name.trim(),
      email: email.toLowerCase().trim(),
      password_hash: hash,
      role,
      session_token: token,
      token_expires_at: expires,
      is_active: true,
      ...extra,
    });
    localStorage.setItem(SESSION_KEY, token);
    localStorage.setItem(SESSION_EXPIRY_KEY, expires);
    setUser(newUser);
    return newUser;
  }, []);

  const logout = useCallback(async () => {
    if (user?.id) {
      try {
        await base44.entities.AppUser.update(user.id, {
          session_token: '',
          token_expires_at: '',
        });
      } catch { /* best effort */ }
    }
    clearLocalSession();
    setUser(null);
    queryClient.clear();
    window.location.href = '/';
  }, [user, queryClient]);

  const refreshUser = useCallback(async () => {
    if (!user?.id) return null;
    const updated = await base44.entities.AppUser.filter({ id: user.id });
    if (updated && updated.length > 0) {
      setUser(updated[0]);
      return updated[0];
    }
    return user;
  }, [user]);

  const updateUser = useCallback(async (data) => {
    if (!user?.id) return;
    await base44.entities.AppUser.update(user.id, data);
    setUser(prev => ({ ...prev, ...data }));
  }, [user]);

  const redirectToLogin = useCallback((next) => {
    if (next) sessionStorage.setItem('rd_login_next', next);
    window.location.href = '/Entrar';
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      refreshUser,
      updateUser,
      redirectToLogin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
