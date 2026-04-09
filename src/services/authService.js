import { z } from 'zod';
import { appUserRepository } from '@/repositories/appUserRepository';
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

const VALID_ROLES = new Set(['patient', 'professional', 'admin']);

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

function normalizeRole(value, fallback = 'patient') {
  return VALID_ROLES.has(value) ? value : fallback;
}

function resolveFullName(authUser, existingUser, fallbackData = {}) {
  const metadata = authUser?.user_metadata || {};
  const explicitName = fallbackData.full_name?.trim();
  const metadataName = metadata.full_name?.trim() || metadata.name?.trim();

  return (
    explicitName ||
    existingUser?.full_name ||
    metadataName ||
    authUser?.email?.split('@')?.[0] ||
    'Usuario'
  );
}

function resolveRole(authUser, existingUser, fallbackData = {}) {
  if (fallbackData.role) {
    return normalizeRole(fallbackData.role, 'patient');
  }

  if (existingUser?.role) {
    return normalizeRole(existingUser.role, 'patient');
  }

  return normalizeRole(authUser?.user_metadata?.role, 'patient');
}

function buildAppUserPayload({ authUser, existingUser = null, fallbackData = {} }) {
  const normalizedEmail = appUserRepository.normalizeEmail(
    fallbackData.email || authUser?.email || existingUser?.email,
  );

  if (!authUser?.id || !normalizedEmail) {
    throw new AppError({
      message: 'Usuario autenticado invalido para vinculo com app_users.',
      userMessage: 'Nao foi possivel identificar a conta autenticada.',
      status: 401,
      code: 'AUTH_USER_INVALID',
    });
  }

  return {
    full_name: resolveFullName(authUser, existingUser, fallbackData),
    email: normalizedEmail,
    role: resolveRole(authUser, existingUser, fallbackData),
    is_active: existingUser?.is_active ?? true,
    phone: fallbackData.phone ?? existingUser?.phone ?? '',
    cpf: fallbackData.cpf ?? existingUser?.cpf ?? '',
    birth_date: fallbackData.birth_date ?? existingUser?.birth_date ?? '',
    sex: fallbackData.sex ?? existingUser?.sex ?? '',
    address: fallbackData.address ?? existingUser?.address ?? '',
    city: fallbackData.city ?? existingUser?.city ?? '',
    state: fallbackData.state ?? existingUser?.state ?? '',
    auth_user_id: authUser.id,
  };
}

async function ensureAppUserLinked(authUser, fallbackData = {}) {
  const normalizedEmail = appUserRepository.normalizeEmail(
    fallbackData.email || authUser?.email,
  );

  const existingUser = await appUserRepository.findBySupabaseIdentity({
    authUserId: authUser?.id,
    email: normalizedEmail,
  });
  const payload = buildAppUserPayload({
    authUser,
    existingUser,
    fallbackData: {
      ...fallbackData,
      email: normalizedEmail,
    },
  });

  if (existingUser?.id) {
    const updatedUser = await appUserRepository.update(existingUser.id, payload);
    const linkedUser = updatedUser || { ...existingUser, ...payload };

    if (linkedUser.auth_user_id !== authUser.id) {
      throw new AppError({
        message: 'Falha ao sincronizar auth_user_id com app_users.',
        userMessage: 'Nao foi possivel vincular a conta autenticada ao perfil da aplicacao.',
        status: 500,
        code: 'AUTH_USER_LINK_FAILED',
      });
    }

    return ensureActiveUser(linkedUser);
  }

  const createdUser = await appUserRepository.create(payload);

  if (!createdUser?.id || createdUser.auth_user_id !== authUser.id) {
    throw new AppError({
      message: 'Falha ao criar app_users vinculado ao usuario autenticado.',
      userMessage: 'Nao foi possivel concluir a criacao do perfil da aplicacao.',
      status: 500,
      code: 'APP_USER_CREATE_FAILED',
    });
  }

  return ensureActiveUser(createdUser);
}

async function restoreFromSupabaseSession() {
  if (!supabaseAuthRepository.isEnabled()) {
    return null;
  }

  const authUser = await supabaseAuthRepository.getUser();

  if (!authUser) {
    return null;
  }

  return ensureAppUserLinked(authUser);
}

function buildAuthMetadata(registrationData) {
  return {
    full_name: registrationData.full_name.trim(),
    role: registrationData.role,
  };
}

async function ensureAuthenticatedSignupSession({ authData, registrationData }) {
  if (authData?.session) {
    return authData;
  }

  try {
    return await supabaseAuthRepository.signIn({
      email: registrationData.email,
      password: registrationData.password,
    });
  } catch (error) {
    throw new AppError({
      message: 'Cadastro criado sem sessao autenticada.',
      userMessage: 'Conta criada, mas a sessao nao foi iniciada automaticamente. Tente entrar para continuar.',
      status: 409,
      code: 'AUTH_SESSION_NOT_CREATED',
      cause: error,
    });
  }
}

export const authService = {
  async restoreSession() {
    try {
      return await restoreFromSupabaseSession();
    } catch (error) {
      if (error?.code === 'ACCOUNT_INACTIVE') {
        try {
          await supabaseAuthRepository.signOut();
        } catch (signOutError) {
          logUiWarning('auth', {
            stage: 'restore-signout-inactive',
            error: serializeError(signOutError),
          });
        }

        return null;
      }

      throw normalizeError(error, 'Nao foi possivel restaurar a sessao.');
    }
  },

  async login(email, password) {
    const credentials = loginSchema.parse({ email, password });

    try {
      const authData = await supabaseAuthRepository.signIn(credentials);
      const authUser = authData?.user || await supabaseAuthRepository.getUser();

      if (!authUser) {
        throw new AppError({
          message: 'Usuario autenticado nao retornado pelo Supabase.',
          userMessage: 'Nao foi possivel concluir o login.',
          status: 401,
          code: 'AUTH_USER_MISSING',
        });
      }

      return await ensureAppUserLinked(authUser);
    } catch (error) {
      if (error?.code === 'ACCOUNT_INACTIVE') {
        try {
          await supabaseAuthRepository.signOut();
        } catch (signOutError) {
          logUiWarning('auth', {
            stage: 'login-signout-inactive',
            error: serializeError(signOutError),
          });
        }
      }

      throw normalizeError(error, 'Nao foi possivel realizar o login.');
    }
  },

  async register(payload) {
    const registrationData = registerSchema.parse(payload);

    try {
      const existingUser = await appUserRepository.findByEmail(registrationData.email);

      if (existingUser?.auth_user_id) {
        throw new AppError({
          message: 'Este email ja esta cadastrado.',
          userMessage: 'Este email ja esta cadastrado.',
          status: 409,
          code: 'EMAIL_ALREADY_IN_USE',
        });
      }

      const signUpData = await supabaseAuthRepository.signUp({
        email: registrationData.email,
        password: registrationData.password,
        metadata: buildAuthMetadata(registrationData),
      });
      const authData = await ensureAuthenticatedSignupSession({
        authData: signUpData,
        registrationData,
      });
      const authUser = authData?.user || signUpData?.user;

      if (!authUser?.id) {
        throw new AppError({
          message: 'Supabase Auth nao retornou o usuario criado.',
          userMessage: 'Nao foi possivel concluir o cadastro.',
          status: 500,
          code: 'AUTH_SIGNUP_INCOMPLETE',
        });
      }

      return await ensureAppUserLinked(authUser, {
        ...registrationData,
        full_name: registrationData.full_name.trim(),
        email: registrationData.email,
        role: registrationData.role,
      });
    } catch (error) {
      throw normalizeError(error, 'Nao foi possivel concluir o cadastro.');
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

      throw normalizeError(error, 'Nao foi possivel encerrar a sessao.');
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
