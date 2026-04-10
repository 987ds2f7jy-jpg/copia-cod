/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NEXT_PUBLIC_DEEPGRAM_API_KEY?: string;
  readonly NEXT_PUBLIC_GROQ_API_KEY?: string;
  readonly VITE_DEEPGRAM_API_KEY?: string;
  readonly VITE_GROQ_API_KEY?: string;
  readonly VITE_BACKEND_FUNCTIONS_URL?: string;
  readonly VITE_BACKEND_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_APP_ENV?: "development" | "staging" | "production" | "test";
  readonly VITE_MAPBOX_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
