import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/authService';
import { getUserFacingErrorMessage } from '@/lib/errors';
import { resetProfessionalDutyForUser } from '@/lib/professionals';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
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
  }, []);

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

  const logout = useCallback(async () => {
    if (user?.role === 'professional' && user?.id) {
      try {
        await resetProfessionalDutyForUser(user.id);
      } catch {
        // Best effort only. Logout must still complete.
      }
    }

    await authService.logout();
    setUser(null);
    queryClient.clear();
    window.location.href = '/';
  }, [queryClient, user]);

  const refreshUser = useCallback(async () => {
    if (!user?.id) {
      return null;
    }

    const updatedUser = await authService.refreshUser(user.id);

    if (updatedUser) {
      setUser(updatedUser);
      return updatedUser;
    }

    return user;
  }, [user]);

  const updateUser = useCallback(async (data) => {
    if (!user?.id) {
      return null;
    }

    const updatedUser = await authService.updateUser(user.id, data);

    if (updatedUser) {
      setUser(updatedUser);
      return updatedUser;
    }

    return null;
  }, [user]);

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
        logout,
        refreshUser,
        updateUser,
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
