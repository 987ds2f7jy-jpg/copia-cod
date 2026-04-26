const TRANSIENT_STATUSES = new Set([429, 502, 503, 504]);
const AUTH_STATUSES = new Set([401, 403]);

const PRICING_CONFIGURATION_CODES = new Set([
  'DUTY_SPECIALTY_NOT_PRICED',
  'PLATFORM_FEE_RULE_NOT_CONFIGURED',
  'PLATFORM_PRICE_NOT_CONFIGURED',
  'PROFESSIONAL_PRICE_NOT_CONFIGURED',
  'PROFESSIONAL_PROFILE_NOT_FOUND_FOR_PRICING',
  'PROFESSIONAL_PROFILE_REQUIRED_FOR_PRICING',
  'SOLICITACAO_EXAME_SERVICE_NOT_PRICED',
]);

function normalizeStatus(status) {
  const parsed = Number(status);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function isNetworkError(error) {
  const message = String(error?.message || '').toLowerCase();

  return (
    error?.code === 'NETWORK_ERROR' ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed')
  );
}

export function classifyApiError(error) {
  const status = normalizeStatus(error?.status);
  const code = normalizeCode(error?.code);

  if (TRANSIENT_STATUSES.has(status) || code === 'SUPABASE_EDGE_RUNTIME_ERROR' || isNetworkError(error)) {
    return {
      category: 'transient',
      severity: 'warn',
      retryable: true,
    };
  }

  if (AUTH_STATUSES.has(status) || code.startsWith('AUTH_') || code.includes('UNAUTHORIZED')) {
    return {
      category: 'auth',
      severity: 'error',
      retryable: false,
    };
  }

  if (PRICING_CONFIGURATION_CODES.has(code)) {
    return {
      category: 'business',
      severity: 'warn',
      retryable: false,
    };
  }

  return {
    category: 'fatal',
    severity: 'error',
    retryable: false,
  };
}

export function isTransientApiError(error) {
  return classifyApiError(error).category === 'transient';
}

export function shouldRetryIdempotentApiError(error) {
  return classifyApiError(error).retryable;
}
