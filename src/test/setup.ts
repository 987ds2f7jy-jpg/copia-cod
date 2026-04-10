import "@testing-library/jest-dom";

const testEnv = import.meta.env as unknown as Record<string, string>;
testEnv.VITE_BACKEND_FUNCTIONS_URL ||= "http://localhost:54321/functions/v1";
testEnv.VITE_BACKEND_PUBLISHABLE_KEY ||= "test-publishable-key";

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
