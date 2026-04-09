import { base44 } from '@/api/base44Client';

const APP_USER_ALLOWED_FIELDS = new Set([
  'full_name',
  'email',
  'role',
  'is_active',
  'phone',
  'cpf',
  'birth_date',
  'sex',
  'address',
  'city',
  'state',
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

  async findByAuthUserId(authUserId) {
    if (!authUserId) {
      return null;
    }

    const results = await base44.entities.AppUser.filter({ auth_user_id: authUserId }, undefined, 1);
    return firstOrNull(results);
  },

  async findBySupabaseIdentity({ authUserId, email }) {
    if (authUserId) {
      const user = await this.findByAuthUserId(authUserId);

      if (user) {
        return user;
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
};
