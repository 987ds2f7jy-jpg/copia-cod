const LOCAL_PAYMENT_ENVIRONMENTS = new Set(['local', 'development', 'test']);

export function normalizeAppEnvironment(value: unknown) {
  return String(value ?? '').trim().toLowerCase() || 'unknown';
}

export function isLocalPaymentEnvironment(value: unknown) {
  return LOCAL_PAYMENT_ENVIRONMENTS.has(normalizeAppEnvironment(value));
}
