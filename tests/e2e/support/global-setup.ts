/**
 * support/global-setup.ts
 *
 * PROPÓSITO
 *   Executa UMA VEZ antes de toda a suíte E2E.
 *   Faz login para cada role (patient, professional, admin) e salva o
 *   storageState em arquivos .json. Os spec files carregam esses arquivos
 *   via `use: { storageState }`, evitando login repetido em cada teste.
 *
 * POR QUE EXISTE
 *   Login via UI a cada teste é lento e cria dependência no fluxo de auth
 *   em testes que não são sobre auth. Esta abordagem isola completamente
 *   o "estar logado" do "testar o login".
 *
 * RISCO COBERTO
 *   R3 — o estado de sessão é gerado de forma limpa a cada execução da suíte,
 *   nunca herdando tokens corrompidos de runs anteriores.
 *
 * NOTA IMPORTANTE
 *   O arquivo .auth/ está no .gitignore. Nunca commitar tokens reais.
 *   Em CI, este setup roda sempre do zero.
 *
 * TODO (quando os testes de auth estiverem prontos)
 *   Adicionar seed de dados de teste via Supabase service_role key antes
 *   de gerar o storageState, garantindo que os usuários existam no banco.
 */

import { chromium, type FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { USERS, ROUTES } from './constants';
import { loginViaUIRaw, clearAuthStateRaw, gotoRaw } from './fixtures';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTH_DIR = path.join(__dirname, '../.auth');

async function saveAuthState(
  config: FullConfig,
  role: keyof typeof USERS,
) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: config.projects[0]?.use?.baseURL ?? 'http://localhost:8080',
  });
  const page = await context.newPage();

  try {
    const user = USERS[role];
    await clearAuthStateRaw(page);
    await loginViaUIRaw(page, user.email, user.password);

    await page.waitForURL(
      (url) => !url.pathname.includes('/Entrar'),
      { timeout: 15_000 },
    );

    const stateFile = path.join(AUTH_DIR, `${role}.json`);
    await context.storageState({ path: stateFile });

    console.log(`[global-setup] Auth state saved for role: ${role}`);
  } catch (err) {
    console.warn(`[global-setup] Could not create auth state for role: ${role}`);
    console.warn(`  → Make sure E2E_${role.toUpperCase()}_EMAIL and _PASSWORD are set.`);
    console.warn(`  → Error: ${(err as Error).message}`);
    fs.writeFileSync(path.join(AUTH_DIR, `${role}.json`), '{"cookies":[],"origins":[]}');
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(config: FullConfig) {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  await saveAuthState(config, 'patient');
  await saveAuthState(config, 'professional');

  if (process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD) {
    await saveAuthState(config, 'admin');
  } else {
    fs.writeFileSync(path.join(AUTH_DIR, 'admin.json'), '{"cookies":[],"origins":[]}');
    console.log('[global-setup] Admin auth skipped: E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD not configured.');
  }
}
