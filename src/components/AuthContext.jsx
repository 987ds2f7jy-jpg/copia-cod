import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/authService';
import { getUserFacingErrorMessage } from '@/lib/errors';
import { resetProfessionalDutyForUser } from '@/lib/professionals';

const AuthContext = createContext(null);
let logoutRedirectInProgress = false;

export function isLogoutRedirectInProgress() {
  return logoutRedirectInProgress;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const clearPostLoginRedirect = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.removeItem('rd_login_next');
  }, []);

  const markLogoutRedirectInProgress = useCallback(() => {
    logoutRedirectInProgress = true;
  }, []);

  const clearLogoutRedirectInProgress = useCallback(() => {
    logoutRedirectInProgress = false;
  }, []);

  const clearClientState = useCallback(() => {
    setUser(null);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('rd_last_active_consultation');
      window.sessionStorage.removeItem('rd_consulta_agora_auto_resume');
    }
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    clearLogoutRedirectInProgress();

    let isMounted = true;

    const syncSession = async () => {
      try {
        const restoredUser = await authService.restoreSession();

        if (isMounted) {
          setUser(restoredUser);
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    syncSession();

    const unsubscribe = authService.subscribeToAuthChanges((nextUser) => {
      if (!isMounted) {
        return;
      }

      setUser(nextUser);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [clearLogoutRedirectInProgress]);

  const login = useCallback(async (email, password) => {
    try {
      const nextUser = await authService.login(email, password);
      setUser(nextUser);
      return nextUser;
    } catch (error) {
      throw new Error(getUserFacingErrorMessage(error, 'Erro ao fazer login.'));
    }
  }, []);

  const register = useCallback(async ({ full_name, email, password, role = 'patient', ...extra }) => {
    try {
      const newUser = await authService.register({
        full_name,
        email,
        password,
        role,
        ...extra,
      });

      setUser(newUser);
      return newUser;
    } catch (error) {
      throw new Error(getUserFacingErrorMessage(error, 'Erro ao concluir o cadastro.'));
    }
  }, []);

  const requestPasswordReset = useCallback(async (email) => {
    try {
      await authService.requestPasswordReset(email);
    } catch (error) {
      throw new Error(getUserFacingErrorMessage(error, 'Nao foi possivel enviar o email de recuperacao.'));
    }
  }, []);

  const resetPassword = useCallback(async (password) => {
    try {
      await authService.resetPassword(password);
    } catch (error) {
      throw new Error(getUserFacingErrorMessage(error, 'Nao foi possivel redefinir a senha.'));
    }
  }, []);

  const logout = useCallback(async () => {
    if (user?.role === 'professional' && user?.id) {
      try {
        await resetProfessionalDutyForUser(user.id);
      } catch {
        // Best effort only. Logout must still complete.
      }
    }

    clearPostLoginRedirect();
    markLogoutRedirectInProgress();
    await authService.logout();
    clearClientState();
    window.location.href = '/';
  }, [clearClientState, clearPostLoginRedirect, markLogoutRedirectInProgress, user]);

  const refreshUser = useCallback(async () => {
    const updatedUser = await authService.refreshUser();

    if (updatedUser) {
      setUser(updatedUser);
      return updatedUser;
    }

    setUser(null);
    return null;
  }, []);

  const updateUser = useCallback(async (data) => {
    if (!user) {
      return null;
    }

    const updatedUser = await authService.updateUser(data);

    if (updatedUser) {
      setUser(updatedUser);
      return updatedUser;
    }

    return null;
  }, [user]);

  const deactivateAccount = useCallback(async () => {
    if (user?.role === 'professional' && user?.id) {
      try {
        await resetProfessionalDutyForUser(user.id);
      } catch {
        // Best effort only. Deactivation must still complete.
      }
    }

    clearPostLoginRedirect();
    markLogoutRedirectInProgress();
    await authService.deactivateAccount();
    clearClientState();
    window.location.href = '/';
  }, [clearClientState, clearPostLoginRedirect, markLogoutRedirectInProgress, user]);

  const redirectToLogin = useCallback((next) => {
    if (next) {
      sessionStorage.setItem('rd_login_next', next);
    }

    window.location.href = '/Entrar';
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        requestPasswordReset,
        resetPassword,
        logout,
        refreshUser,
        updateUser,
        deactivateAccount,
        redirectToLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return ctx;
}
