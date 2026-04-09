import { AppError } from './errors.ts';
import type { AuthenticatedUser } from './types.ts';

export type AuthenticatedUserLookup = (
  accessToken: string,
) => Promise<AuthenticatedUser | null>;

export function getBearerToken(req: Request) {
  const authHeader = req.headers.get('Authorization') || '';

  if (!authHeader.startsWith('Bearer ')) {
    throw new AppError({
      status: 401,
      code: 'AUTH_REQUIRED',
      message: 'Authorization header with Bearer token is required.',
    });
  }

  const accessToken = authHeader.slice('Bearer '.length).trim();

  if (!accessToken || accessToken === 'null' || accessToken === 'undefined') {
    throw new AppError({
      status: 401,
      code: 'AUTH_TOKEN_INVALID',
      message: 'Authorization token is invalid.',
    });
  }

  return accessToken;
}

export async function requireAuthenticatedUser(
  req: Request,
  lookup: AuthenticatedUserLookup,
) {
  const accessToken = getBearerToken(req);
  const authenticatedUser = await lookup(accessToken);

  if (!authenticatedUser?.authUserId) {
    throw new AppError({
      status: 401,
      code: 'AUTH_USER_INVALID',
      message: 'Unable to resolve authenticated user.',
    });
  }

  return authenticatedUser;
}
