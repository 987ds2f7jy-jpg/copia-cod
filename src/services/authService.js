import { z } from 'zod';
import accountApi from '@/client-api/account';
import { recoverySupabase } from '@/integrations/supabase/recoveryClient';
import {
  clearStoredSession,
  getStoredSession,
  saveStoredSession,
  subscribeToSessionChanges,
} from '@/client-api/session';
import { ensureFreshSession } from '@/client-api/edgeFunctions';
import { isTransientApiError } from '@/lib/api-errors';
import { AppError, normalizeError } from '@/lib/errors';
import { logUiWarning, serializeError } from '@/lib/observability';
import { createPageUrl } from '@/utils';

const loginSchema = z.object({
  email: z.string().trim().email('Email invalido.'),
  password: z.string().min(1, 'Senha obrigatoria.'),
});

const recoveryEmailSchema = z.object({
  email: z.string().trim().email('Email invalido.'),
});

const resetPasswordSchema = z.object({
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres.'),
});

const registerSchema = z.object({
  full_name: z.string().trim().min(3, 'Nome completo obrigatorio.'),
  email: z.string().trim().email('Email invalido.'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres.'),
  role: z.enum(['patient', 'professional']).default('patient'),
}).passthrough();

function normalizeEmail(email) {
  return email?.toLowerCase().trim() || '';
}

function parseRecoveryEmail(email) {
  try {
    return recoveryEmailSchema.parse({ email });
  } catch (error) {
    throw new AppError({
      message: 'Email invalido.',
      userMessage: 'Informe um email valido.',
      status: 400,
      code: 'EMAIL_INVALID',
      cause: error,
    });
  }
}

function parseResetPassword(password) {
  try {
    return resetPasswordSchema.parse({ password });
  } catch (error) {
    throw new AppError({
      message: 'Senha invalida.',
      userMessage: 'A nova senha deve ter ao menos 6 caracteres.',
      status: 400,
      code: 'PASSWORD_INVALID',
      cause: error,
    });
  }
}

function buildPasswordRecoveryRedirectUrl() {
  if (typeof window === 'undefined') {
    return '';
  }

  const url = new URL(createPageUrl('RecuperarSenha'), window.location.origin);
  url.searchParams.set('mode', 'reset');
  return url.toString();
}

function toUiUser(accountUser) {
  if (!accountUser?.id) {
    return null;
  }

  return {
    id: accountUser.id,
    auth_user_id: accountUser.authUserId || '',
    full_name: accountUser.fullName || '',
    email: normalizeEmail(accountUser.email),
    role: accountUser.role || 'patient',
    is_active: accountUser.isActive !== false,
    phone: accountUser.phone || '',
    cpf: accountUser.cpf || '',
    birth_date: accountUser.birthDate || '',
    sex: accountUser.sex || '',
    address: accountUser.address || '',
    city: accountUser.city || '',
    state: accountUser.state || '',
    profile_complete: Boolean(accountUser.profileComplete),
  };
}

function ensureActiveUser(user) {
  if (!user) {
    throw new AppError({
      message: 'Conta nao encontrada.',
      userMessage: 'Conta nao encontrada.',
      status: 404,
      code: 'ACCOUNT_NOT_FOUND',
    });
  }

  if (user.is_active === false) {
    throw new AppError({
      message: 'Conta inativa.',
      userMessage: 'Sua conta esta inativa no momento.',
      status: 403,
      code: 'ACCOUNT_INACTIVE',
    });
  }

  return user;
}

function normalizeAccountError(error, fallbackMessage) {
  const normalized = normalizeError(error, fallbackMessage);

  if (normalized.code === 'AUTH_CREDENTIALS_INVALID') {
    return new AppError({
      message: 'Credenciais invalidas.',
      userMessage: 'Email ou senha invalidos.',
      code: normalized.code,
      status: normalized.status,
      details: normalized.details,
      hint: normalized.hint,
      cause: normalized.cause,
    });
  }

  if (isTransientApiError(normalized)) {
    return new AppError({
      message: fallbackMessage,
      userMessage: fallbackMessage,
      code: normalized.code,
      status: normalized.status,
      details: normalized.details,
      hint: normalized.hint,
      cause: normalized.cause,
    });
  }

  return normalized;
}

function mapRegisterPayload(registrationData) {
  return {
    fullName: registrationData.full_name.trim(),
    email: normalizeEmail(registrationData.email),
    password: registrationData.password,
    role: registrationData.role,
    phone: registrationData.phone?.trim() || '',
    cpf: registrationData.cpf?.trim() || '',
    birthDate: registrationData.birth_date?.trim() || '',
    sex: registrationData.sex?.trim() || '',
    address: registrationData.address?.trim() || '',
    city: registrationData.city?.trim() || '',
    state: registrationData.state?.trim().toUpperCase() || '',
    termsAccepted: registrationData.termsAccepted === true,
    privacyAcknowledged: registrationData.privacyAcknowledged === true,
  };
}

function sanitizeProfilePayload(data = {}) {
  const payload = {};
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(data, key);

  if (hasOwn('full_name')) {
    const fullName = String(data.full_name ?? '').trim();

    if (fullName && fullName.length < 3) {
      throw new AppError({
        message: 'Nome completo invalido.',
        userMessage: 'Informe um nome completo valido.',
        status: 400,
        code: 'FULL_NAME_INVALID',
      });
    }

    payload.fullName = fullName;
  }

  if (hasOwn('phone')) {
    payload.phone = String(data.phone ?? '').trim();
  }

  if (hasOwn('cpf')) {
    payload.cpf = String(data.cpf ?? '').trim();
  }

  if (hasOwn('birth_date')) {
    payload.birthDate = String(data.birth_date ?? '').trim();
  }

  if (hasOwn('sex')) {
    payload.sex = String(data.sex ?? '').trim();
  }

  if (hasOwn('address')) {
    payload.address = String(data.address ?? '').trim();
  }

  if (hasOwn('city')) {
    payload.city = String(data.city ?? '').trim();
  }

  if (hasOwn('state')) {
    payload.state = String(data.state ?? '').trim().toUpperCase();
  }

  return payload;
}

async function syncAccountFromSession(payload = undefined) {
  const result = await accountApi.bootstrapAppUserRequest(payload || {});
  return ensureActiveUser(toUiUser(result?.appUser || null));
}

async function clearInactiveSession(error, stage) {
  if (error?.code !== 'ACCOUNT_INACTIVE') {
    return;
  }

  try {
    clearStoredSession();
  } catch (signOutError) {
    logUiWarning('auth', {
      stage,
      error: serializeError(signOutError),
    });
  }
}

export const authService = {
  async restoreSession() {
    try {
      const session = getStoredSession();

      if (!session?.accessToken) {
        return null;
      }

      const readySession = await ensureFreshSession();

      if (!readySession?.accessToken) {
        return null;
      }

      return await syncAccountFromSession();
    } catch (error) {
      await clearInactiveSession(error, 'restore-signout-inactive');
      throw normalizeAccountError(error, 'Nao foi possivel restaurar a sessao.');
    }
  },

  async login(email, password) {
    const credentials = loginSchema.parse({ email, password });

    try {
      const result = await accountApi.loginAppUserRequest({
        email: credentials.email,
        password: credentials.password,
      });

      if (!result?.session?.accessToken || !result?.session?.refreshToken) {
        throw new AppError({
          message: 'Login concluido sem sessao autenticada.',
          userMessage: 'Login concluido, mas a sessao nao foi iniciada automaticamente. Tente novamente.',
          status: 409,
          code: 'AUTH_SESSION_NOT_CREATED',
        });
      }

      saveStoredSession(result.session);
      return ensureActiveUser(toUiUser(result.appUser || null));
    } catch (error) {
      await clearInactiveSession(error, 'login-signout-inactive');
      throw normalizeAccountError(error, 'Nao foi possivel realizar o login.');
    }
  },

  async register(payload) {
    const registrationData = registerSchema.parse(payload);

    try {
      const result = await accountApi.bootstrapAppUserRequest(
        mapRegisterPayload(registrationData),
      );

      if (!result?.session?.accessToken || !result?.session?.refreshToken) {
        throw new AppError({
          message: 'Cadastro criado sem sessao autenticada.',
          userMessage: 'Conta criada, mas a sessao nao foi iniciada automaticamente. Tente entrar para continuar.',
          status: 409,
          code: 'AUTH_SESSION_NOT_CREATED',
        });
      }

      saveStoredSession(result.session);
      return ensureActiveUser(toUiUser(result.appUser || null));
    } catch (error) {
      throw normalizeAccountError(error, 'Nao foi possivel concluir o cadastro.');
    }
  },

  async requestPasswordReset(email) {
    const payload = parseRecoveryEmail(email);

    try {
      const { error } = await recoverySupabase.auth.resetPasswordForEmail(
        normalizeEmail(payload.email),
        {
          redirectTo: buildPasswordRecoveryRedirectUrl(),
        },
      );

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      throw normalizeAccountError(error, 'Nao foi possivel enviar o email de recuperacao.');
    }
  },

  async resetPassword(password) {
    const payload = parseResetPassword(password);

    try {
      const { data, error } = await recoverySupabase.auth.updateUser({
        password: payload.password,
      });

      if (error) {
        throw error;
      }

      if (!data?.user?.id) {
        throw new AppError({
          message: 'Sessao de recuperacao nao confirmada.',
          userMessage: 'Nao foi possivel confirmar a redefinicao da senha. Solicite um novo link e tente novamente.',
          status: 409,
          code: 'AUTH_RECOVERY_SESSION_MISSING',
        });
      }

      return data.user;
    } catch (error) {
      throw normalizeAccountError(error, 'Nao foi possivel redefinir a senha.');
    }
  },

  async logout() {
    try {
      clearStoredSession();
    } catch (error) {
      logUiWarning('auth', {
        stage: 'logout-local-session',
        error: serializeError(error),
      });

      throw normalizeAccountError(error, 'Nao foi possivel encerrar a sessao.');
    }
  },

  async refreshUser() {
    try {
      const session = getStoredSession();

      if (!session?.accessToken) {
        return null;
      }

      const readySession = await ensureFreshSession();

      if (!readySession?.accessToken) {
        return null;
      }

      return await syncAccountFromSession();
    } catch (error) {
      await clearInactiveSession(error, 'refresh-signout-inactive');
      throw normalizeAccountError(error, 'Nao foi possivel atualizar o usuario.');
    }
  },

  async updateUser(data) {
    try {
      const payload = sanitizeProfilePayload(data);

      if (Object.keys(payload).length === 0) {
        return await this.refreshUser();
      }

      const result = await accountApi.updateMyProfileRequest(payload);
      return ensureActiveUser(toUiUser(result?.appUser || null));
    } catch (error) {
      throw normalizeAccountError(error, 'Nao foi possivel atualizar os dados do usuario.');
    }
  },

  async deactivateAccount() {
    try {
      await accountApi.deactivateAccountRequest();
    } catch (error) {
      throw normalizeAccountError(error, 'Nao foi possivel desativar a conta.');
    }

    try {
      clearStoredSession();
    } catch (error) {
      logUiWarning('auth', {
        stage: 'deactivate-local-signout',
        error: serializeError(error),
      });
    }
  },

  subscribeToAuthChanges(listener) {
    return subscribeToSessionChanges(async () => {
      try {
        const sessionUser = await this.restoreSession();
        listener(sessionUser);
      } catch {
        listener(null);
      }
    });
  },
};
