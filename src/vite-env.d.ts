/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: "local" | "development" | "staging" | "production" | "test";
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_BACKEND_FUNCTIONS_URL?: string;
  readonly VITE_BACKEND_PUBLISHABLE_KEY?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_MAPBOX_TOKEN: string;
  readonly VITE_ENABLE_PAYMENT_SIMULATION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
