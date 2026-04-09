import { supabase } from '@/integrations/supabase/client';

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

async function resolveFunctionError(error, fallbackMessage) {
  const response = error?.context;

  if (response && typeof response.clone === 'function') {
    try {
      const payload = await response.clone().json();

      if (payload?.error?.message) {
        return {
          message: payload.error.message,
          code: payload.error.code || error?.code || 'EDGE_FUNCTION_ERROR',
          status: response.status || error?.status || 500,
          details: payload.error.details || null,
        };
      }
    } catch {
      // Ignore non-JSON error responses and keep the fallback message.
    }
  }

  return {
    message: error?.message || fallbackMessage,
    code: error?.code || 'EDGE_FUNCTION_ERROR',
    status: error?.status || response?.status || 500,
    details: error?.details || null,
  };
}

export async function invokeEdgeFunction(functionName, {
  body,
  fallbackMessage,
}) {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  });

  if (error) {
    throw createFunctionError(await resolveFunctionError(error, fallbackMessage));
  }

  if (data?.error?.message) {
    throw createFunctionError({
      message: data.error.message,
      code: data.error.code,
      status: data.error.status || 500,
      details: data.error.details || null,
    });
  }

  return data?.data ?? data;
}
