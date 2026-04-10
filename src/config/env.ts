import { z } from "zod";

const envSchema = z.object({
  VITE_BACKEND_FUNCTIONS_URL: z.string().url("VITE_BACKEND_FUNCTIONS_URL precisa ser uma URL valida."),
  VITE_BACKEND_PUBLISHABLE_KEY: z.string().min(1, "VITE_BACKEND_PUBLISHABLE_KEY e obrigatoria."),
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
  edgeFunctionsBaseUrl: rawEnv.VITE_BACKEND_FUNCTIONS_URL.replace(/\/$/, ""),
  edgeFunctionsPublishableKey: rawEnv.VITE_BACKEND_PUBLISHABLE_KEY,
  appEnv: rawEnv.VITE_APP_ENV ?? (import.meta.env.PROD ? "production" : "development"),
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
};
