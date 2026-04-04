/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NEXT_PUBLIC_DEEPGRAM_API_KEY?: string;
  readonly NEXT_PUBLIC_GROQ_API_KEY?: string;
  readonly VITE_SUPABASE_PROJECT_ID?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_ENABLE_SUPABASE_AUTH?: "true" | "false";
  readonly VITE_APP_ENV?: "development" | "staging" | "production" | "test";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
