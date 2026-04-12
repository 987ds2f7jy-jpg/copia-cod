import { env } from '@/config/env';
import {
  clearStoredSession,
  getStoredSession,
  saveStoredSession,
} from './session';

function createFunctionError({
  message,
  code = 'EDGE_FUNCTION_ERROR',
  status = 500,
  details = null,
}) {
  const functionError = new Error(message);
  functionError.name = 'EdgeFunctionError';
  functionError.code = code;
  functionError.status = status;
  functionError.details = details;
  return functionError;
}

async function parseResponsePayload(response) {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function resolveAuthToken(authMode) {
  if (authMode === 'none') {
    return '';
  }

  if (authMode === 'anon') {
    return env.edgeFunctionsPublishableKey;
  }

  const session = getStoredSession();

  if ((authMode === 'session' || authMode === 'optional') && session?.accessToken) {
    return session.accessToken;
  }

  if (authMode === 'session') {
    throw createFunctionError({
      message: 'Sessao autenticada obrigatoria.',
      code: 'AUTH_SESSION_REQUIRED',
      status: 401,
    });
  }

  return '';
}

function buildHeaders({ body, authMode }) {
  const headers = new Headers();
  headers.set('apikey', env.edgeFunctionsPublishableKey);

  const authToken = resolveAuthToken(authMode);

  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  if (!(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

function buildRequestBody(body) {
  if (body instanceof FormData) {
    return body;
  }

  return JSON.stringify(body ?? {});
}

async function executeEdgeFunction(functionName, {
  body,
  fallbackMessage,
  authMode,
}) {
  const response = await fetch(`${env.edgeFunctionsBaseUrl}/${functionName}`, {
    method: 'POST',
    headers: buildHeaders({ body, authMode }),
    body: buildRequestBody(body),
  });

  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    throw createFunctionError({
      message: payload?.error?.message || fallbackMessage || 'Erro ao chamar o backend.',
      code: payload?.error?.code || 'EDGE_FUNCTION_ERROR',
      status: response.status,
      details: payload?.error?.details || null,
    });
  }

  if (payload?.error?.message) {
    throw createFunctionError({
      message: payload.error.message,
      code: payload.error.code,
      status: payload.error.status || 500,
      details: payload.error.details || null,
    });
  }

  return payload?.data ?? payload;
}

let refreshPromise = null;

function toSessionExpiryMs(session) {
  const expiresAt = Number(session?.expiresAt ?? 0);

  if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
    return null;
  }

  return expiresAt < 1_000_000_000_000 ? expiresAt * 1000 : expiresAt;
}

async function refreshStoredSessionOnce() {
  const currentSession = getStoredSession();

  if (!currentSession?.refreshToken) {
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = executeEdgeFunction('refresh-app-session', {
      body: {
        refreshToken: currentSession.refreshToken,
      },
      fallbackMessage: 'Nao foi possivel renovar a sessao.',
      authMode: 'anon',
    })
      .then((result) => {
        const nextSession = result?.session;

        if (!nextSession?.accessToken || !nextSession?.refreshToken) {
          clearStoredSession();
          return null;
        }

        return saveStoredSession(nextSession);
      })
      .catch((error) => {
        clearStoredSession();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function ensureFreshSession({ minValidityMs = 60_000 } = {}) {
  const currentSession = getStoredSession();

  if (!currentSession?.accessToken) {
    return null;
  }

  const expiresAtMs = toSessionExpiryMs(currentSession);

  if (!expiresAtMs) {
    return currentSession;
  }

  if ((expiresAtMs - Date.now()) > minValidityMs) {
    return currentSession;
  }

  return refreshStoredSessionOnce();
}

export async function invokeEdgeFunction(functionName, {
  body,
  fallbackMessage,
  authMode = 'session',
  retryOnUnauthorized = true,
}) {
  try {
    return await executeEdgeFunction(functionName, {
      body,
      fallbackMessage,
      authMode,
    });
  } catch (error) {
    if (
      retryOnUnauthorized &&
      (authMode === 'session' || authMode === 'optional') &&
      error?.status === 401
    ) {
      const refreshedSession = await refreshStoredSessionOnce();

      if (refreshedSession?.accessToken) {
        return executeEdgeFunction(functionName, {
          body,
          fallbackMessage,
          authMode,
        });
      }
    }

    throw error;
  }
}
