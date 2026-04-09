import { AppError } from '@/lib/errors';

const APP_USER_ALLOWED_FIELDS = new Set([
  'full_name',
  'phone',
  'cpf',
  'birth_date',
  'sex',
  'address',
  'city',
  'state',
]);

function createDeprecatedRepositoryError(methodName) {
  return new AppError({
    message: `appUserRepository.${methodName} is deprecated.`,
    userMessage: 'Acesso direto a app_users no frontend foi removido. Use src/client-api/account.js.',
    code: 'APP_USER_REPOSITORY_DEPRECATED',
    status: 500,
  });
}

function normalizeOptionalString(value) {
  return value == null ? '' : String(value).trim();
}

function mapAccountUser(accountUser) {
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

function sanitizeAppUserPayload(data = {}) {
  return Object.entries(data).reduce((payload, [key, value]) => {
    if (!APP_USER_ALLOWED_FIELDS.has(key) || value === undefined) {
      return payload;
    }

    payload[key] = normalizeOptionalString(value);
    return payload;
  }, {});
}

async function throwDeprecatedRepositoryError(methodName) {
  throw createDeprecatedRepositoryError(methodName);
}

export const appUserRepository = {
  normalizeEmail,
  sanitizeAppUserPayload,
  mapAccountUser,

  async findById() {
    return throwDeprecatedRepositoryError('findById');
  },

  async findByEmail() {
    return throwDeprecatedRepositoryError('findByEmail');
  },

  async findByAuthUserId() {
    return throwDeprecatedRepositoryError('findByAuthUserId');
  },

  async findBySupabaseIdentity() {
    return throwDeprecatedRepositoryError('findBySupabaseIdentity');
  },

  async create() {
    return throwDeprecatedRepositoryError('create');
  },

  async update() {
    return throwDeprecatedRepositoryError('update');
  },
};

export default appUserRepository;

function normalizeEmail(email) {
  return email?.toLowerCase().trim() || '';
}
