import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 2,                    // Akita ama isso (falhou? tenta de novo)
  workers: 3,
  reporter: [['html'], ['list']],
  use: {
    baseURL: 'http://localhost:8080',   // ← Porta padrão do Vite (muito importante!)
    headless: true,                     // mude para false se quiser ver o navegador rodando
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'on-first-retry',
  },
});