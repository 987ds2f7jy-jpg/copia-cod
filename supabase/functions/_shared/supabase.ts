import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import type { AuthenticatedUserLookup } from './auth.ts';

export type SupabaseClient = ReturnType<typeof createClient>;

export function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function createServiceRoleClient() {
  return createClient(getRequiredEnv('SUPABASE_URL'), getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createSupabaseAuthUserLookup(client: SupabaseClient): AuthenticatedUserLookup {
  return async (accessToken: string) => {
    const { data, error } = await client.auth.getUser(accessToken);

    if (error || !data?.user?.id) {
      return null;
    }

    return {
      authUserId: data.user.id,
      email: data.user.email ?? null,
    };
  };
}
