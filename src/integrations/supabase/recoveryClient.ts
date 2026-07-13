import { createClient } from '@supabase/supabase-js';
import { env } from '@/config/env';

// Password recovery must use the same Supabase project that serves the deployed edge functions.
export const recoverySupabase = createClient(
  env.supabaseUrl,
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
