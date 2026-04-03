import { z } from "zod";

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url("VITE_SUPABASE_URL precisa ser uma URL valida."),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, "VITE_SUPABASE_PUBLISHABLE_KEY e obrigatoria."),
  VITE_ENABLE_SUPABASE_AUTH: z.enum(["true", "false"]).optional(),
  VITE_APP_ENV: z.enum(["development", "staging", "production", "test"]).optional(),
});

const parsedEnv = envSchema.safeParse(import.meta.env);

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Configuracao de ambiente invalida: ${issues}`);
}

const rawEnv = parsedEnv.data;

export const env = {
  supabaseUrl: rawEnv.VITE_SUPABASE_URL,
  supabasePublishableKey: rawEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
  enableSupabaseAuth: rawEnv.VITE_ENABLE_SUPABASE_AUTH !== "false",
  appEnv: rawEnv.VITE_APP_ENV ?? (import.meta.env.PROD ? "production" : "development"),
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
};
