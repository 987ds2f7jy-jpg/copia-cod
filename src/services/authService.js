import { z } from 'zod';
import accountApi from '@/client-api/account';
import { supabaseAuthRepository } from '@/repositories/supabaseAuthRepository';
import { AppError, normalizeError } from '@/lib/errors';
import { logUiWarning, serializeError } from '@/lib/observability';

const loginSchema = z.object({
  email: z.string().trim().email('Email invalido.'),
  password: z.string().min(1, 'Senha obrigatoria.'),
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
  return normalizeError(error, fallbackMessage);
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
  };
}

function mapBootstrapPayload(registrationData) {
  return {
    fullName: registrationData.full_name.trim(),
    role: registrationData.role,
    phone: registrationData.phone?.trim() || '',
    cpf: registrationData.cpf?.trim() || '',
    birthDate: registrationData.birth_date?.trim() || '',
    sex: registrationData.sex?.trim() || '',
    address: registrationData.address?.trim() || '',
    city: registrationData.city?.trim() || '',
    state: registrationData.state?.trim().toUpperCase() || '',
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
    await supabaseAuthRepository.signOut();
  } catch (signOutError) {
    logUiWarning('auth', {
      stage,
      error: serializeError(signOutError),
    });
  }
}

export const authService = {
  async restoreSession() {
    if (!supabaseAuthRepository.isEnabled()) {
      return null;
    }

    try {
      const session = await supabaseAuthRepository.getSession();

      if (!session?.access_token) {
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
      await supabaseAuthRepository.signIn(credentials);
      return await syncAccountFromSession();
    } catch (error) {
      await clearInactiveSession(error, 'login-signout-inactive');
      throw normalizeAccountError(error, 'Nao foi possivel realizar o login.');
    }
  },

  async register(payload) {
    const registrationData = registerSchema.parse(payload);

    try {
      const signupPayload = mapRegisterPayload(registrationData);
      const signupResult = await supabaseAuthRepository.signUp({
        email: signupPayload.email,
        password: signupPayload.password,
        metadata: {
          full_name: signupPayload.fullName,
          role: signupPayload.role,
        },
      });
      const accessToken = signupResult?.session?.access_token;
      const refreshToken = signupResult?.session?.refresh_token;

      if (!accessToken || !refreshToken) {
        throw new AppError({
          message: 'Cadastro no Supabase Auth nao retornou sessao.',
          userMessage: 'Conta criada, mas a sessao nao foi iniciada automaticamente. Tente entrar para continuar.',
          status: 409,
          code: 'AUTH_SESSION_NOT_CREATED',
        });
      }

      await supabaseAuthRepository.setSession({
        accessToken,
        refreshToken,
      });

      const result = await accountApi.bootstrapAppUserRequest(
        mapBootstrapPayload(registrationData),
      );

      return ensureActiveUser(toUiUser(result?.appUser || null));
    } catch (error) {
      throw normalizeAccountError(error, 'Nao foi possivel concluir o cadastro.');
    }
  },

  async logout() {
    if (!supabaseAuthRepository.isEnabled()) {
      return;
    }

    try {
      await supabaseAuthRepository.signOut();
    } catch (error) {
      logUiWarning('auth', {
        stage: 'logout-supabase',
        error: serializeError(error),
      });

      throw normalizeAccountError(error, 'Nao foi possivel encerrar a sessao.');
    }
  },

  async refreshUser() {
    try {
      const session = await supabaseAuthRepository.getSession();

      if (!session?.access_token) {
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
      await supabaseAuthRepository.signOut();
    } catch (error) {
      logUiWarning('auth', {
        stage: 'deactivate-local-signout',
        error: serializeError(error),
      });
    }
  },

  subscribeToAuthChanges(listener) {
    return supabaseAuthRepository.subscribe(async () => {
      try {
        const sessionUser = await this.restoreSession();
        listener(sessionUser);
      } catch {
        listener(null);
      }
    });
  },
};
