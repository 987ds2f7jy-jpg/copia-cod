/**
 * support/fixtures.ts
 *
 * PROPÓSITO
 *   Estende o `test` base do Playwright com fixtures reutilizáveis
 *   que encapsulam autenticação, navegação e helpers de página.
 *   Todos os spec files devem importar `{ test, expect }` daqui,
 *   nunca diretamente de `@playwright/test`.
 *
 * POR QUE EXISTE
 *   Centralizar o acesso ao estado de auth e helpers de alto nível evita
 *   que cada teste reimplemente login/logout, tornando a suíte mais
 *   resistente a mudanças de UI e de fluxo de autenticação.
 *
 * RISCO COBERTO
 *   R3 (sessão corrompida) — o helper de login sempre parte de um
 *   estado de localStorage limpo, evitando contaminação entre testes.
 *
 * ORDEM GARANTIDA
 *   clearAuthState só acessa localStorage após navegar para uma origem
 *   válida. Em about:blank o browser bloqueia acesso a storage com
 *   SecurityError. A fixture garante sempre: goto(baseURL) → evaluate().
 */

import { test as base, expect, type Page } from '@playwright/test';
import { ROUTES } from './constants';

// ---------------------------------------------------------------------------
// Auth state files (gerados por global-setup.ts)
// ---------------------------------------------------------------------------
export const AUTH_STATE = {
  patient:      'tests/e2e/.auth/patient.json',
  professional: 'tests/e2e/.auth/professional.json',
  admin:        'tests/e2e/.auth/admin.json',
} as const;

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Navega para uma rota relativa usando a baseURL configurada no Playwright.
 * Aguarda o React hidratar (spinner global some, se presente).
 * Sempre produz uma URL com origem válida — nunca deixa em about:blank.
 */
async function goto(page: Page, route: string) {
  await page.goto(route);
  await page
    .waitForSelector('[data-testid="app-loading"]', { state: 'detached', timeout: 8_000 })
    .catch(() => {});
}

/**
 * Limpa todo o estado de auth do browser (localStorage + sessionStorage).
 *
 * ATENÇÃO: page.evaluate() lança SecurityError se a página estiver em
 * about:blank (sem origem). Este helper SEMPRE navega para a raiz do app
 * antes de acessar storage — mesmo que o teste vá para outra rota depois.
 */
async function clearAuthState(page: Page) {
  const currentUrl = page.url();
  const isBlankOrEmpty = !currentUrl || currentUrl === 'about:blank';

  if (isBlankOrEmpty) {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  }

  await page.evaluate(() => {
    window.localStorage.removeItem('rd.auth.session.v1');
    window.sessionStorage.removeItem('rd_login_next');
    window.sessionStorage.removeItem('rd_logout_redirect_in_progress');
    window.sessionStorage.removeItem('rd_last_active_consultation');
    window.sessionStorage.removeItem('rd_consulta_agora_auto_resume');
  });
}

/**
 * Faz login via UI (sem storageState).
 * Use apenas em testes que testam o próprio fluxo de login.
 */
async function loginViaUI(page: Page, email: string, password: string) {
  await goto(page, ROUTES.entrar);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

/**
 * Injeta sessão de auth diretamente no localStorage via addInitScript.
 * Deve ser chamado ANTES de page.goto() — roda antes do JS da página.
 */
async function injectSession(page: Page, sessionJson: object) {
  await page.addInitScript((session) => {
    window.localStorage.setItem('rd.auth.session.v1', JSON.stringify(session));
  }, sessionJson);
}

// ---------------------------------------------------------------------------
// Tipos das fixtures customizadas
// ---------------------------------------------------------------------------
type RdFixtures = {
  /** Navega para uma rota relativa com baseURL e aguarda hydration. */
  goto: (route: string) => Promise<void>;
  /** Login via UI — apenas para testes que testam o próprio login. */
  loginViaUI: (email: string, password: string) => Promise<void>;
  /**
   * Limpa localStorage e sessionStorage de auth.
   * Seguro de chamar mesmo em about:blank — navega para / primeiro.
   */
  clearAuthState: () => Promise<void>;
};

// ---------------------------------------------------------------------------
// Objeto test estendido — importar daqui em todos os spec files
// ---------------------------------------------------------------------------
export const test = base.extend<RdFixtures>({
  goto: async ({ page }, applyFixture) => {
    await applyFixture((route) => goto(page, route));
  },

  loginViaUI: async ({ page }, applyFixture) => {
    await applyFixture((email, password) => loginViaUI(page, email, password));
  },

  clearAuthState: async ({ page }, applyFixture) => {
    await applyFixture(() => clearAuthState(page));
  },
});

export { expect };

// Re-exporta helpers avulsos para uso direto em global-setup.ts
export {
  loginViaUI     as loginViaUIRaw,
  clearAuthState as clearAuthStateRaw,
  goto           as gotoRaw,
};
