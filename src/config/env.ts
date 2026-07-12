import { z } from "zod";

const envSchema = z.object({
  VITE_BACKEND_FUNCTIONS_URL: z.string().url(),
  VITE_BACKEND_PUBLISHABLE_KEY: z.string().min(1),
  VITE_MAPBOX_TOKEN: z.string().min(1),
  VITE_APP_ENV: z.enum(["local", "development", "staging", "production", "test"]).optional(),
  VITE_ENABLE_PAYMENT_SIMULATION: z
    .string()
    .transform((value) => value === "true")
    .optional(),
});

const parsedEnv = envSchema.safeParse(import.meta.env);

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Configuracao de ambiente invalida: ${issues}`);
}

const rawEnv = parsedEnv.data;
const backendFunctionsUrl = rawEnv.VITE_BACKEND_FUNCTIONS_URL;
const appEnv = rawEnv.VITE_APP_ENV ?? (import.meta.env.PROD ? "production" : "development");
const localSimulationEnvironment = ["local", "development", "test"].includes(appEnv);

export const env = {
  edgeFunctionsBaseUrl: backendFunctionsUrl.replace(/\/$/, ""),
  edgeFunctionsPublishableKey: rawEnv.VITE_BACKEND_PUBLISHABLE_KEY,
  mapboxToken: rawEnv.VITE_MAPBOX_TOKEN,
  appEnv,
  paymentSimulationEnabled: localSimulationEnvironment && rawEnv.VITE_ENABLE_PAYMENT_SIMULATION === true,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
};
