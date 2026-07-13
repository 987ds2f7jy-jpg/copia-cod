import { z } from "zod";

const envSchema = z.object({
  VITE_APP_ENV: z.enum(["local", "development", "staging", "production", "test"]),
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  VITE_BACKEND_FUNCTIONS_URL: z.string().url().optional(),
  VITE_BACKEND_PUBLISHABLE_KEY: z.string().min(1).optional(),
  VITE_SITE_URL: z.string().url().optional(),
  VITE_MAPBOX_TOKEN: z.string().min(1),
  VITE_ENABLE_PAYMENT_SIMULATION: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
}).superRefine((value, context) => {
  const strictEnvironment = value.VITE_APP_ENV === "staging" || value.VITE_APP_ENV === "production";

  if (strictEnvironment && !value.VITE_SUPABASE_URL) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["VITE_SUPABASE_URL"],
      message: "obrigatoria em staging e production",
    });
  }

  if (strictEnvironment && !value.VITE_SUPABASE_ANON_KEY) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["VITE_SUPABASE_ANON_KEY"],
      message: "obrigatoria em staging e production",
    });
  }

  if (strictEnvironment && !value.VITE_SITE_URL) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["VITE_SITE_URL"],
      message: "obrigatoria em staging e production",
    });
  }

  if (strictEnvironment && value.VITE_ENABLE_PAYMENT_SIMULATION === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["VITE_ENABLE_PAYMENT_SIMULATION"],
      message: "obrigatoria em staging e production",
    });
  } else if (strictEnvironment && value.VITE_ENABLE_PAYMENT_SIMULATION === true) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["VITE_ENABLE_PAYMENT_SIMULATION"],
      message: "deve permanecer false fora de local/test",
    });
  }
});

const parsedEnv = envSchema.safeParse({
  VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_BACKEND_FUNCTIONS_URL: import.meta.env.VITE_BACKEND_FUNCTIONS_URL,
  VITE_BACKEND_PUBLISHABLE_KEY: import.meta.env.VITE_BACKEND_PUBLISHABLE_KEY,
  VITE_SITE_URL: import.meta.env.VITE_SITE_URL,
  VITE_MAPBOX_TOKEN: import.meta.env.VITE_MAPBOX_TOKEN,
  VITE_ENABLE_PAYMENT_SIMULATION: import.meta.env.VITE_ENABLE_PAYMENT_SIMULATION,
});

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Configuracao de ambiente invalida: ${issues}`);
}

const rawEnv = parsedEnv.data;
const appEnv = rawEnv.VITE_APP_ENV;
const strictEnvironment = appEnv === "staging" || appEnv === "production";
const supabaseUrl = rawEnv.VITE_SUPABASE_URL
  || (!strictEnvironment && rawEnv.VITE_BACKEND_FUNCTIONS_URL?.replace(/\/functions\/v1\/?$/, ""));
const publishableKey = rawEnv.VITE_SUPABASE_ANON_KEY
  || (!strictEnvironment && rawEnv.VITE_SUPABASE_PUBLISHABLE_KEY)
  || (!strictEnvironment && rawEnv.VITE_BACKEND_PUBLISHABLE_KEY);

if (!supabaseUrl || !publishableKey) {
  throw new Error("Configuracao de ambiente invalida: URL e anon key do Supabase sao obrigatorias.");
}

const localSimulationEnvironment = ["local", "development", "test"].includes(appEnv);

export const env = {
  supabaseUrl: supabaseUrl.replace(/\/$/, ""),
  edgeFunctionsBaseUrl: `${supabaseUrl.replace(/\/$/, "")}/functions/v1`,
  edgeFunctionsPublishableKey: publishableKey,
  siteUrl: rawEnv.VITE_SITE_URL?.replace(/\/$/, "") || "",
  mapboxToken: rawEnv.VITE_MAPBOX_TOKEN,
  appEnv,
  paymentSimulationEnabled: localSimulationEnvironment && rawEnv.VITE_ENABLE_PAYMENT_SIMULATION === true,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
};
