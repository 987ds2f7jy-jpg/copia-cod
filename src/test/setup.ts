import "@testing-library/jest-dom";

const testEnv = import.meta.env as unknown as Record<string, string>;
testEnv.VITE_APP_ENV ||= "test";
testEnv.VITE_SUPABASE_URL ||= "http://localhost:54321";
testEnv.VITE_SUPABASE_ANON_KEY ||= "test-publishable-key";
testEnv.VITE_MAPBOX_TOKEN ||= "test-public-mapbox-token";
testEnv.VITE_ENABLE_PAYMENT_SIMULATION ||= "false";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
