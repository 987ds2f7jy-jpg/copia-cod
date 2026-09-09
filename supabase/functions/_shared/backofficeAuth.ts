import { AppError } from './errors.ts';
import { getRequiredEnv, type SupabaseClient } from './supabase.ts';

const TOKEN_ISSUER = 'rapido-doutor-backoffice';
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 8;
const PASSWORD_ALGORITHM = 'PBKDF2';
const PASSWORD_DIGEST = 'SHA-256';

export type BackofficeAdmin = {
  id: string;
  email: string;
};

type AdminTokenPayload = {
  iss: string;
  sub: string;
  email: string;
  iat: number;
  exp: number;
};

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeJson(value: unknown) {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJson<T>(value: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(value))) as T;
  } catch {
    return null;
  }
}

async function importHmacKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function sign(value: string) {
  const key = await importHmacKey(getRequiredEnv('ADMIN_JWT_SECRET'));
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return toBase64Url(new Uint8Array(signature));
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

function getSessionTtlSeconds() {
  const configured = Number(Deno.env.get('ADMIN_SESSION_TTL_SECONDS') || DEFAULT_SESSION_TTL_SECONDS);
  if (!Number.isFinite(configured) || configured < 300 || configured > 60 * 60 * 24) {
    return DEFAULT_SESSION_TTL_SECONDS;
  }
  return Math.floor(configured);
}

export function normalizeAdminEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

export async function createBackofficeToken(admin: BackofficeAdmin) {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminTokenPayload = {
    iss: TOKEN_ISSUER,
    sub: admin.id,
    email: admin.email,
    iat: now,
    exp: now + getSessionTtlSeconds(),
  };
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const body = encodeJson(payload);
  const signature = await sign(`${header}.${body}`);

  return {
    accessToken: `${header}.${body}.${signature}`,
    expiresAt: payload.exp,
  };
}

async function verifyBackofficeToken(token: string): Promise<AdminTokenPayload> {
  const [header, body, signature, extra] = token.split('.');
  if (!header || !body || !signature || extra) {
    throw new AppError({ status: 401, code: 'ADMIN_TOKEN_INVALID', message: 'Invalid administrative session.' });
  }

  const parsedHeader = decodeJson<{ alg?: string; typ?: string }>(header);
  const payload = decodeJson<AdminTokenPayload>(body);
  if (parsedHeader?.alg !== 'HS256' || parsedHeader?.typ !== 'JWT' || !payload) {
    throw new AppError({ status: 401, code: 'ADMIN_TOKEN_INVALID', message: 'Invalid administrative session.' });
  }

  const expectedSignature = await sign(`${header}.${body}`);
  let signaturesMatch = false;
  try {
    signaturesMatch = equalBytes(fromBase64Url(signature), fromBase64Url(expectedSignature));
  } catch {
    signaturesMatch = false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (!signaturesMatch || payload.iss !== TOKEN_ISSUER || !payload.sub || !payload.email || !Number.isFinite(payload.exp) || payload.exp <= now) {
    throw new AppError({ status: 401, code: 'ADMIN_TOKEN_INVALID', message: 'Administrative session is invalid or expired.' });
  }

  return payload;
}

function getBearerToken(req: Request) {
  const authorization = req.headers.get('Authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]?.trim()) {
    throw new AppError({ status: 401, code: 'ADMIN_AUTHORIZATION_REQUIRED', message: 'Administrative authorization is required.' });
  }
  return match[1].trim();
}

export async function requireActiveBackofficeAdmin(req: Request, client: SupabaseClient): Promise<BackofficeAdmin> {
  const payload = await verifyBackofficeToken(getBearerToken(req));
  const { data, error } = await client
    .from('admin_users')
    .select('id, email, is_active')
    .eq('id', payload.sub)
    .maybeSingle();

  if (error) {
    throw new AppError({ status: 500, code: 'ADMIN_LOOKUP_FAILED', message: 'Unable to validate administrative session.' });
  }

  const admin = data as { id?: string; email?: string; is_active?: boolean } | null;
  if (!admin?.id || !admin.is_active || normalizeAdminEmail(admin.email) !== normalizeAdminEmail(payload.email)) {
    throw new AppError({ status: 401, code: 'ADMIN_SESSION_REVOKED', message: 'Administrative session is no longer active.' });
  }

  return { id: admin.id, email: normalizeAdminEmail(admin.email) };
}

export async function verifyAdminPassword(password: string, passwordHash: string) {
  const [algorithm, digest, iterationsRaw, saltEncoded, expectedEncoded, extra] = passwordHash.split('$');
  const iterations = Number(iterationsRaw);
  if (
    algorithm !== PASSWORD_ALGORITHM ||
    digest !== PASSWORD_DIGEST ||
    !Number.isInteger(iterations) ||
    iterations < 100_000 ||
    iterations > 2_000_000 ||
    !saltEncoded ||
    !expectedEncoded ||
    extra
  ) {
    return false;
  }

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      PASSWORD_ALGORITHM,
      false,
      ['deriveBits'],
    );
    const derived = await crypto.subtle.deriveBits(
      { name: PASSWORD_ALGORITHM, hash: PASSWORD_DIGEST, salt: fromBase64Url(saltEncoded), iterations },
      key,
      fromBase64Url(expectedEncoded).length * 8,
    );
    return equalBytes(new Uint8Array(derived), fromBase64Url(expectedEncoded));
  } catch {
    return false;
  }
}
