# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: patient\planos.spec.ts >> planos - formulario empresas >> submit simulado mostra feedback e reseta campos sem chamar backend @critical
- Location: tests\e2e\patient\planos.spec.ts:148:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8080/
Call log:
  - navigating to "http://localhost:8080/", waiting until "load"

```

# Test source

```ts
  1   | /**
  2   |  * support/fixtures.ts
  3   |  *
  4   |  * PROPÓSITO
  5   |  *   Estende o `test` base do Playwright com fixtures reutilizáveis
  6   |  *   que encapsulam autenticação, navegação e helpers de página.
  7   |  *   Todos os spec files devem importar `{ test, expect }` daqui,
  8   |  *   nunca diretamente de `@playwright/test`.
  9   |  *
  10  |  * POR QUE EXISTE
  11  |  *   Centralizar o acesso ao estado de auth e helpers de alto nível evita
  12  |  *   que cada teste reimplemente login/logout, tornando a suíte mais
  13  |  *   resistente a mudanças de UI e de fluxo de autenticação.
  14  |  *
  15  |  * RISCO COBERTO
  16  |  *   R3 (sessão corrompida) — o helper de login sempre parte de um
  17  |  *   estado de localStorage limpo, evitando contaminação entre testes.
  18  |  *
  19  |  * ORDEM GARANTIDA
  20  |  *   clearAuthState só acessa localStorage após navegar para uma origem
  21  |  *   válida. Em about:blank o browser bloqueia acesso a storage com
  22  |  *   SecurityError. A fixture garante sempre: goto(baseURL) → evaluate().
  23  |  */
  24  | 
  25  | import { test as base, expect, type Page } from '@playwright/test';
  26  | import { ROUTES } from './constants';
  27  | 
  28  | // ---------------------------------------------------------------------------
  29  | // Auth state files (gerados por global-setup.ts)
  30  | // ---------------------------------------------------------------------------
  31  | export const AUTH_STATE = {
  32  |   patient:      'tests/e2e/.auth/patient.json',
  33  |   professional: 'tests/e2e/.auth/professional.json',
  34  |   admin:        'tests/e2e/.auth/admin.json',
  35  | } as const;
  36  | 
  37  | // ---------------------------------------------------------------------------
  38  | // Helpers internos
  39  | // ---------------------------------------------------------------------------
  40  | 
  41  | /**
  42  |  * Navega para uma rota relativa usando a baseURL configurada no Playwright.
  43  |  * Aguarda o React hidratar (spinner global some, se presente).
  44  |  * Sempre produz uma URL com origem válida — nunca deixa em about:blank.
  45  |  */
  46  | async function goto(page: Page, route: string) {
  47  |   await page.goto(route);
  48  |   await page
  49  |     .waitForSelector('[data-testid="app-loading"]', { state: 'detached', timeout: 8_000 })
  50  |     .catch(() => {});
  51  | }
  52  | 
  53  | /**
  54  |  * Limpa todo o estado de auth do browser (localStorage + sessionStorage).
  55  |  *
  56  |  * ATENÇÃO: page.evaluate() lança SecurityError se a página estiver em
  57  |  * about:blank (sem origem). Este helper SEMPRE navega para a raiz do app
  58  |  * antes de acessar storage — mesmo que o teste vá para outra rota depois.
  59  |  */
  60  | async function clearAuthState(page: Page) {
  61  |   const currentUrl = page.url();
  62  |   const isBlankOrEmpty = !currentUrl || currentUrl === 'about:blank';
  63  | 
  64  |   if (isBlankOrEmpty) {
> 65  |     await page.goto('/');
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8080/
  66  |     await page.waitForLoadState('domcontentloaded');
  67  |   }
  68  | 
  69  |   await page.evaluate(() => {
  70  |     window.localStorage.removeItem('rd.auth.session.v1');
  71  |     window.sessionStorage.removeItem('rd_login_next');
  72  |     window.sessionStorage.removeItem('rd_logout_redirect_in_progress');
  73  |     window.sessionStorage.removeItem('rd_last_active_consultation');
  74  |     window.sessionStorage.removeItem('rd_consulta_agora_auto_resume');
  75  |   });
  76  | }
  77  | 
  78  | /**
  79  |  * Faz login via UI (sem storageState).
  80  |  * Use apenas em testes que testam o próprio fluxo de login.
  81  |  */
  82  | async function loginViaUI(page: Page, email: string, password: string) {
  83  |   await goto(page, ROUTES.entrar);
  84  |   await page.getByLabel('Email').fill(email);
  85  |   await page.getByLabel('Senha', { exact: true }).fill(password);
  86  |   await page.getByRole('button', { name: 'Entrar' }).click();
  87  | }
  88  | 
  89  | /**
  90  |  * Injeta sessão de auth diretamente no localStorage via addInitScript.
  91  |  * Deve ser chamado ANTES de page.goto() — roda antes do JS da página.
  92  |  */
  93  | async function injectSession(page: Page, sessionJson: object) {
  94  |   await page.addInitScript((session) => {
  95  |     window.localStorage.setItem('rd.auth.session.v1', JSON.stringify(session));
  96  |   }, sessionJson);
  97  | }
  98  | 
  99  | // ---------------------------------------------------------------------------
  100 | // Tipos das fixtures customizadas
  101 | // ---------------------------------------------------------------------------
  102 | type RdFixtures = {
  103 |   /** Navega para uma rota relativa com baseURL e aguarda hydration. */
  104 |   goto: (route: string) => Promise<void>;
  105 |   /** Login via UI — apenas para testes que testam o próprio login. */
  106 |   loginViaUI: (email: string, password: string) => Promise<void>;
  107 |   /**
  108 |    * Limpa localStorage e sessionStorage de auth.
  109 |    * Seguro de chamar mesmo em about:blank — navega para / primeiro.
  110 |    */
  111 |   clearAuthState: () => Promise<void>;
  112 | };
  113 | 
  114 | // ---------------------------------------------------------------------------
  115 | // Objeto test estendido — importar daqui em todos os spec files
  116 | // ---------------------------------------------------------------------------
  117 | export const test = base.extend<RdFixtures>({
  118 |   goto: async ({ page }, applyFixture) => {
  119 |     await applyFixture((route) => goto(page, route));
  120 |   },
  121 | 
  122 |   loginViaUI: async ({ page }, applyFixture) => {
  123 |     await applyFixture((email, password) => loginViaUI(page, email, password));
  124 |   },
  125 | 
  126 |   clearAuthState: async ({ page }, applyFixture) => {
  127 |     await applyFixture(() => clearAuthState(page));
  128 |   },
  129 | });
  130 | 
  131 | export { expect };
  132 | 
  133 | // Re-exporta helpers avulsos para uso direto em global-setup.ts
  134 | export {
  135 |   loginViaUI     as loginViaUIRaw,
  136 |   clearAuthState as clearAuthStateRaw,
  137 |   goto           as gotoRaw,
  138 | };
  139 | 
```