import { buildCorsHeaders } from './http.ts';
import type { CorsOptions } from './http.ts';

export const BACKOFFICE_CORS: CorsOptions = {
  allowOrigin: '*',
  allowedHeaders: ['authorization', 'x-client-info', 'apikey', 'content-type'],
  allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};

export function handleBackofficePreflight(req: Request) {
  if (req.method !== 'OPTIONS') return null;

  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(BACKOFFICE_CORS),
  });
}
