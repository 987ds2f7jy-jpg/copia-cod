const isDev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

function buildEntry(type, payload = {}) {
  return {
    type,
    at: new Date().toISOString(),
    ...payload,
  };
}

function writeLog(level, label, payload) {
  const entry = buildEntry(label, payload);
  const method = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  method(`[${label}]`, entry);
}

export function logApiRequest(payload) {
  if (!isDev) return;
  writeLog('info', 'api.request', payload);
}

export function logApiResponse(payload) {
  if (!isDev) return;
  writeLog('info', 'api.response', payload);
}

export function logApiError(payload) {
  writeLog('error', 'api.error', payload);
}

export function logUiWarning(scope, payload) {
  writeLog('warn', `${scope}.warn`, payload);
}

export function serializeError(error) {
  if (!error) return null;

  return {
    message: error.message || String(error),
    code: error.code || error.status || null,
    details: error.details || null,
    hint: error.hint || null,
  };
}
