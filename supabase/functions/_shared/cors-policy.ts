const LOCAL_ENVIRONMENTS = new Set(['local', 'development', 'test']);
const DEFAULT_LOCAL_ORIGIN = 'http://localhost:8080';

function normalizeEnvironment(value: unknown) {
  return String(value ?? '').trim().toLowerCase() || 'unknown';
}

function normalizeOrigin(value: unknown) {
  const candidate = String(value ?? '').trim().replace(/\/+$/, '');

  if (!candidate || candidate === '*') {
    return '';
  }

  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
      return '';
    }
    return url.origin;
  } catch {
    return '';
  }
}

export function resolveAllowedCorsOrigins({
  appEnvironment,
  configuredOrigins,
}: {
  appEnvironment: unknown;
  configuredOrigins: unknown;
}) {
  const environment = normalizeEnvironment(appEnvironment);
  const configured = String(configuredOrigins ?? '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
  const uniqueOrigins = [...new Set(configured)];

  if (uniqueOrigins.length > 0) {
    return uniqueOrigins;
  }

  return LOCAL_ENVIRONMENTS.has(environment) ? [DEFAULT_LOCAL_ORIGIN] : [];
}

export function isCorsOriginAllowed(origin: unknown, allowedOrigins: string[]) {
  const normalizedOrigin = normalizeOrigin(origin);
  return Boolean(normalizedOrigin && allowedOrigins.includes(normalizedOrigin));
}

export function getCanonicalCorsOrigin(allowedOrigins: string[]) {
  return allowedOrigins[0] || '';
}
