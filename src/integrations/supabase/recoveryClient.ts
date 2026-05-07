import { createClient } from '@supabase/supabase-js';
import { env } from '@/config/env';

function resolveSupabaseProjectUrl() {
  const functionsBaseUrl = env.edgeFunctionsBaseUrl.replace(/\/+$/, '');

  if (functionsBaseUrl.endsWith('/functions/v1')) {
    return functionsBaseUrl.slice(0, -'/functions/v1'.length);
  }

  return functionsBaseUrl;
}

// Password recovery must use the same Supabase project that serves the deployed edge functions.
export const recoverySupabase = createClient(
  resolveSupabaseProjectUrl(),
  env.edgeFunctionsPublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: true,
      storageKey: 'rd.auth.recovery.v1',
    },
  },
);
