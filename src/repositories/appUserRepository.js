import { base44 } from '@/api/base44Client';
import { supabase } from '@/integrations/supabase/client';
import { hasColumnMissingError } from '@/lib/errors';
import { logUiWarning } from '@/lib/observability';

let authUserIdSupportedPromise;

const APP_USER_ALLOWED_FIELDS = new Set([
  'full_name',
  'email',
  'password_hash',
  'role',
  'session_token',
  'token_expires_at',
  'is_active',
  'phone',
  'cpf',
  'birth_date',
  'sex',
  'address',
  'city',
  'state',
  'profile_complete',
  'auth_user_id',
]);

function firstOrNull(items) {
  return Array.isArray(items) && items.length > 0 ? items[0] : null;
}

function normalizeEmail(email) {
  return email?.toLowerCase().trim() || '';
}

function sanitizeAppUserPayload(data = {}) {
  return Object.entries(data).reduce((payload, [key, value]) => {
    if (!APP_USER_ALLOWED_FIELDS.has(key) || value === undefined) {
      return payload;
    }

    payload[key] = key === 'email' ? normalizeEmail(value) : value;
    return payload;
  }, {});
}

async function supportsAuthUserIdColumn() {
  if (authUserIdSupportedPromise) {
    return authUserIdSupportedPromise;
  }

  authUserIdSupportedPromise = (async () => {
    const { error } = await supabase
      .from('app_users')
      .select('id, auth_user_id')
      .limit(1);

    if (!error) {
      return true;
    }

    if (hasColumnMissingError(error, 'auth_user_id')) {
      logUiWarning('auth', {
        stage: 'schema-probe',
        message: 'A coluna app_users.auth_user_id ainda nao esta disponivel.',
      });
      return false;
    }

    throw error;
  })();

  return authUserIdSupportedPromise;
}

export const appUserRepository = {
  normalizeEmail,

  async findById(id) {
    if (!id) {
      return null;
    }

    try {
      return await base44.entities.AppUser.get(id);
    } catch (error) {
      if (error?.status === 406) {
        return null;
      }

      throw error;
    }
  },

  async findByEmail(email) {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return null;
    }

    const results = await base44.entities.AppUser.filter({ email: normalizedEmail }, undefined, 1);
    return firstOrNull(results);
  },

  async findActiveByEmailAndPasswordHash(email, passwordHash) {
    const normalizedEmail = normalizeEmail(email);

    const results = await base44.entities.AppUser.filter({
      email: normalizedEmail,
      password_hash: passwordHash,
      is_active: true,
    }, undefined, 1);

    return firstOrNull(results);
  },

  async findBySessionToken(sessionToken) {
    if (!sessionToken) {
      return null;
    }

    const results = await base44.entities.AppUser.filter({ session_token: sessionToken }, undefined, 1);
    return firstOrNull(results);
  },

  async findBySupabaseIdentity({ authUserId, email }) {
    if (authUserId && await supportsAuthUserIdColumn()) {
      try {
        const results = await base44.entities.AppUser.filter({ auth_user_id: authUserId }, undefined, 1);
        const user = firstOrNull(results);

        if (user) {
          return user;
        }
      } catch (error) {
        if (!hasColumnMissingError(error, 'auth_user_id')) {
          throw error;
        }

        authUserIdSupportedPromise = Promise.resolve(false);
      }
    }

    return this.findByEmail(email);
  },

  async create(data) {
    return base44.entities.AppUser.create(sanitizeAppUserPayload(data));
  },

  async update(id, data) {
    if (!id) {
      return null;
    }

    const payload = sanitizeAppUserPayload(data);

    return base44.entities.AppUser.update(id, payload);
  },

  async setLegacySession(id, { token, expiresAt }) {
    return this.update(id, {
      session_token: token,
      token_expires_at: expiresAt,
    });
  },

  async clearLegacySession(id) {
    return this.update(id, {
      session_token: '',
      token_expires_at: '',
    });
  },

  async syncAuthUserId(id, authUserId) {
    if (!id || !authUserId) {
      return null;
    }

    if (!await supportsAuthUserIdColumn()) {
      return null;
    }

    try {
      return await this.update(id, { auth_user_id: authUserId });
    } catch (error) {
      if (hasColumnMissingError(error, 'auth_user_id')) {
        authUserIdSupportedPromise = Promise.resolve(false);
        return null;
      }

      throw error;
    }
  },
};
