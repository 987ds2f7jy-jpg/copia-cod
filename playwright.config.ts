/**
 * Playwright configuration for the Rápido Doutor E2E suite.
 *
 * HOW TO RUN
 *   npx playwright test --config=tests/e2e/playwright.config.ts
 *   npx playwright test --config=tests/e2e/playwright.config.ts --grep @smoke
 *   npx playwright test --config=tests/e2e/playwright.config.ts --grep @critical
 *
 * PORTA
 *   O Vite está configurado em vite.config.ts com server.port = 8080.
 *   baseURL aponta para 8080. Se mudar a porta do Vite, atualizar aqui também.
 *
 * ENVIRONMENT
 *   Copie tests/e2e/.env.e2e.example → tests/e2e/.env.e2e e preencha.
 *   Nunca commite credenciais reais.
 */

import { defineConfig, devices } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadOptionalEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, 'utf8');

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadOptionalEnvFile(path.join(__dirname, '.env.e2e'));
loadOptionalEnvFile(path.join(__dirname, 'tests/e2e/.env.e2e'));

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';

export default defineConfig({
  testDir: path.join(__dirname, 'tests/e2e'),
  testMatch: '**/*.spec.ts',

  globalSetup: path.join(__dirname, 'tests/e2e/support/global-setup.ts'),

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 2,

  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(__dirname, 'playwright-report'), open: 'never' }],
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },

  webServer: {
  command: 'npm run dev',
  url: BASE_URL,
  reuseExistingServer: true,
  timeout: 60_000,
  stdout: 'ignore',
  stderr: 'pipe',
},

  projects: [
    {
      name: 'smoke',
      testMatch: '**/smoke/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      testMatch: '**/{admin,auth,patient,professional,scheduling,teleconsulta}/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      testMatch: '**/{auth,scheduling}/**/*.spec.ts',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      testMatch: '**/smoke/**/*.spec.ts',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
