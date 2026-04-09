import { supabase } from '@/integrations/supabase/client';

async function resolveFunctionErrorMessage(error, fallbackMessage) {
  const response = error?.context;

  if (response && typeof response.clone === 'function') {
    try {
      const payload = await response.clone().json();

      if (payload?.error?.message) {
        return payload.error.message;
      }
    } catch {
      // Ignore non-JSON error responses and keep the fallback message.
    }
  }

  return error?.message || fallbackMessage;
}

export async function invokeEdgeFunction(functionName, {
  body,
  fallbackMessage,
}) {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  });

  if (error) {
    throw new Error(await resolveFunctionErrorMessage(error, fallbackMessage));
  }

  if (data?.error?.message) {
    throw new Error(data.error.message);
  }

  return data?.data ?? data;
}
