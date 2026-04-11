import { z } from "zod";

const DEFAULT_BACKEND_FUNCTIONS_URL = "https://uyvxvphfwqzzejbqxmaj.supabase.co/functions/v1";
const DEFAULT_BACKEND_PUBLISHABLE_KEY = "sb_publishable_f0C4T5qvgcmtqXP4cdH4cQ_-ULM6Y6j";
const DEFAULT_MAPBOX_TOKEN = "pk.eyJ1IjoicmFwaWRvZHIiLCJhIjoiY21ubzluNWQ2MjJwYjJyb283bGJoenF1NiJ9.wloOLzdU4LVTC2oxYigF3Q";

const envSchema = z.object({
  VITE_BACKEND_FUNCTIONS_URL: z.string().url().optional(),
  VITE_BACKEND_PUBLISHABLE_KEY: z.string().min(1).optional(),
  VITE_MAPBOX_TOKEN: z.string().min(1).optional(),
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
const backendFunctionsUrl = rawEnv.VITE_BACKEND_FUNCTIONS_URL || DEFAULT_BACKEND_FUNCTIONS_URL;

export const env = {
  edgeFunctionsBaseUrl: backendFunctionsUrl.replace(/\/$/, ""),
  edgeFunctionsPublishableKey: rawEnv.VITE_BACKEND_PUBLISHABLE_KEY || DEFAULT_BACKEND_PUBLISHABLE_KEY,
  mapboxToken: rawEnv.VITE_MAPBOX_TOKEN || DEFAULT_MAPBOX_TOKEN,
  appEnv: rawEnv.VITE_APP_ENV ?? (import.meta.env.PROD ? "production" : "development"),
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
};
