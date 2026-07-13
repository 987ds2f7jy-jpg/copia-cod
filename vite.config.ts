import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const publicEnvPrefixes = [
  "VITE_APP_ENV",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_BACKEND_FUNCTIONS_URL",
  "VITE_BACKEND_PUBLISHABLE_KEY",
  "VITE_SITE_URL",
  "VITE_MAPBOX_TOKEN",
  "VITE_ENABLE_PAYMENT_SIMULATION",
];

// https://vitejs.dev/config/
export default defineConfig({
  envPrefix: publicEnvPrefixes,
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
});
