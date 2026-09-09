import { env } from '@/config/env';
import { getStoredBackofficeSession } from './session';

function makeError(message: string, code: string, status: number, details: unknown = null) {
  const error = new Error(message) as Error & { code: string; status: number; details: unknown };
  error.name = 'BackofficeApiError';
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

export async function invokeBackofficeFunction<T>(functionName: string, body: Record<string, unknown> = {}, accessToken?: string): Promise<T> {
  const token = accessToken || getStoredBackofficeSession()?.accessToken;
  const headers = new Headers({
    apikey: env.edgeFunctionsPublishableKey,
    'Content-Type': 'application/json',
  });
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${env.edgeFunctionsBaseUrl}/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    throw makeError(
      payload?.error?.message || 'Não foi possível concluir a operação do backoffice.',
      payload?.error?.code || 'BACKOFFICE_API_ERROR',
      response.status,
      payload?.error?.details || null,
    );
  }
  return (payload?.data ?? payload) as T;
}
