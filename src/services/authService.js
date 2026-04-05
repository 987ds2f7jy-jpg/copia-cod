import { z } from 'zod';
import { appUserRepository } from '@/repositories/appUserRepository';
import { legacySessionRepository } from '@/repositories/legacySessionRepository';
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
  role: z.enum(['patient', 'professional', 'admin']).default('patient'),
}).passthrough();

async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password + 'rd_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function generateToken() {
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  return Array.from(tokenBytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function newExpiry() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
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

async function startLegacySession(user) {
  const token = generateToken();
  const expiresAt = newExpiry();
  const updatedUser = await appUserRepository.setLegacySession(user.id, { token, expiresAt });
  legacySessionRepository.setSession(token, expiresAt);
  return updatedUser || { ...user, session_token: token, token_expires_at: expiresAt };
}

async function clearLegacySession(userId) {
  if (userId) {
    try {
      await appUserRepository.clearLegacySession(userId);
    } catch (error) {
      logUiWarning('auth', {
        stage: 'clear-legacy-session',
        error: serializeError(error),
      });
    }
  }

  legacySessionRepository.clearSession();
}

async function restoreFromSupabaseSession() {
  if (!supabaseAuthRepository.isEnabled()) {
    return null;
  }

  const session = await supabaseAuthRepository.getSession();

  if (!session?.user) {
    return null;
  }

  const appUser = await appUserRepository.findBySupabaseIdentity({
    authUserId: session.user.id,
    email: session.user.email,
  });

  if (!appUser || appUser.is_active === false) {
    await supabaseAuthRepository.signOut();
    legacySessionRepository.clearSession();
    return null;
  }

  const syncedUser = await appUserRepository.syncAuthUserId(appUser.id, session.user.id);
  return syncedUser || appUser;
}

async function ensureSupabaseAccount(registrationData, appUser) {
  if (!supabaseAuthRepository.isEnabled()) {
    return appUser;
  }

  try {
    const result = await supabaseAuthRepository.signUp({
      email: registrationData.email,
      password: registrationData.password,
      metadata: {
        app_user_id: appUser.id,
        full_name: appUser.full_name,
        role: appUser.role,
      },
    });

    if (result?.user?.id) {
      const syncedUser = await appUserRepository.syncAuthUserId(appUser.id, result.user.id);
      return syncedUser || appUser;
    }
  } catch (error) {
    logUiWarning('auth', {
      stage: 'register-supabase',
      email: registrationData.email,
      error: serializeError(error),
    });
  }

  return appUser;
}

async function restoreFromLegacySession() {
  if (!legacySessionRepository.isTokenValid()) {
    legacySessionRepository.clearSession();
    return null;
  }

  const token = legacySessionRepository.getToken();
  const appUser = await appUserRepository.findBySessionToken(token);

  if (!appUser) {
    legacySessionRepository.clearSession();
    return null;
  }

  if (appUser.token_expires_at && new Date(appUser.token_expires_at) <= new Date()) {
    await clearLegacySession(appUser.id);
    return null;
  }

  return ensureActiveUser(appUser);
}

export const authService = {
  async restoreSession() {
    let supabaseUser = null;

    try {
      supabaseUser = await restoreFromSupabaseSession();
    } catch (error) {
      logUiWarning('auth', {
        stage: 'restore-supabase-session',
        error: serializeError(error),
      });
    }

    if (supabaseUser) {
      return supabaseUser;
    }

    try {
      return await restoreFromLegacySession();
    } catch (error) {
      legacySessionRepository.clearSession();
      throw normalizeError(error, 'Nao foi possivel restaurar a sessao.');
    }
  },

  async login(email, password) {
    const credentials = loginSchema.parse({ email, password });

    if (supabaseAuthRepository.isEnabled()) {
      try {
        const authData = await supabaseAuthRepository.signIn(credentials);
        const appUser = authData?.user
          ? await appUserRepository.findBySupabaseIdentity({
            authUserId: authData.user.id,
            email: authData.user.email,
          })
          : null;

        if (appUser?.is_active !== false) {
          const syncedUser = appUser?.id
            ? await appUserRepository.syncAuthUserId(appUser.id, authData?.user?.id)
            : null;

          if (appUser) {
            return startLegacySession(syncedUser || appUser);
          }
        }

        if (authData?.user) {
          await supabaseAuthRepository.signOut();
        }
      } catch (error) {
        logUiWarning('auth', {
          stage: 'login-supabase',
          email: credentials.email,
          error: serializeError(error),
        });
      }
    }

    try {
      const passwordHash = await hashPassword(credentials.password);
      const appUser = await appUserRepository.findActiveByEmailAndPasswordHash(credentials.email, passwordHash);

      if (!appUser) {
        throw new AppError({
          message: 'Email ou senha invalidos.',
          userMessage: 'Email ou senha invalidos.',
          status: 401,
          code: 'INVALID_CREDENTIALS',
        });
      }

      return await startLegacySession(appUser);
    } catch (error) {
      throw normalizeError(error, 'Nao foi possivel realizar o login.');
    }
  },

  async register(payload) {
    const registrationData = registerSchema.parse(payload);

    try {
      const existingUser = await appUserRepository.findByEmail(registrationData.email);

      if (existingUser) {
        throw new AppError({
          message: 'Este email ja esta cadastrado.',
          userMessage: 'Este email ja esta cadastrado.',
          status: 409,
          code: 'EMAIL_ALREADY_IN_USE',
        });
      }

      const passwordHash = await hashPassword(registrationData.password);
      const token = generateToken();
      const expiresAt = newExpiry();
      const appUserPayload = {
        full_name: registrationData.full_name.trim(),
        email: registrationData.email,
        password_hash: passwordHash,
        role: registrationData.role,
        session_token: token,
        token_expires_at: expiresAt,
        is_active: true,
        phone: payload.phone || '',
        cpf: payload.cpf || '',
        birth_date: payload.birth_date || '',
        sex: payload.sex || '',
        address: payload.address || '',
        city: payload.city || '',
        state: payload.state || '',
        profile_complete: Boolean(payload.profile_complete),
      };

      const newUser = await appUserRepository.create(appUserPayload);

      legacySessionRepository.setSession(token, expiresAt);

      return await ensureSupabaseAccount(registrationData, newUser);
    } catch (error) {
      throw normalizeError(error, 'Nao foi possivel concluir o cadastro.');
    }
  },

  async logout(user) {
    await clearLegacySession(user?.id);

    if (supabaseAuthRepository.isEnabled()) {
      try {
        await supabaseAuthRepository.signOut();
      } catch (error) {
        logUiWarning('auth', {
          stage: 'logout-supabase',
          error: serializeError(error),
        });
      }
    }
  },

  async refreshUser(userId) {
    if (!userId) {
      return null;
    }

    const user = await appUserRepository.findById(userId);
    return ensureActiveUser(user);
  },

  async updateUser(userId, data) {
    if (!userId) {
      return null;
    }

    return appUserRepository.update(userId, data);
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
