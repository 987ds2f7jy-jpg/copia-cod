/**
 * auth/logout.spec.ts
 *
 * TIPO: Fluxo crítico
 *
 * PROPÓSITO
 *   Garantir que o logout limpa completamente o estado do cliente:
 *   sessão em localStorage, itens de sessionStorage, e que rotas
 *   protegidas voltam a exigir login após o logout.
 *
 * SELETORES
 *   O botão de logout fica dentro de um DropdownMenu no Layout.jsx.
 *   Fluxo: abrir dropdown (botão com nome do usuário) → clicar em "Sair".
 *   O DropdownMenuTrigger não tem aria-label fixo — usa o primeiro nome
 *   do usuário ou "Usuário" como fallback (Layout.jsx linha ~212).
 *
 *   Estratégia robusta: localizar o trigger pelo primeiro nome do usuário
 *   OU pelo texto "Usuário" como fallback, usando regex.
 *
 * DEPENDÊNCIAS
 *   Usa storageState do global-setup — não depende do fluxo de login.
 *   Se .auth/patient.json não existir, o teste fará skip automaticamente.
 *
 * RISCO COBERTO
 *   R3 — token residual após logout permite acesso indevido
 */

import { test, expect } from '../support/fixtures';
import { AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';
import { openUserMenu, logoutViaMenu } from '../support/page-helpers';

// Helper: abre o dropdown do usuário no Layout e clica em "Sair"
async function logout(page: import('@playwright/test').Page) {
  await logoutViaMenu(page);
}

// ---------------------------------------------------------------------------
// Logout de paciente
// ---------------------------------------------------------------------------
test.describe('logout — paciente', () => {

  test.use({ storageState: AUTH_STATE.patient });

  test.beforeEach(async ({ page }, testInfo) => {
    void page;
    skipIfNoAuth(testInfo, 'patient');
  });

  test('logout redireciona para home @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardPaciente);
    await expect(page).toHaveURL(/DashboardPaciente/);

    await logout(page);

    // AuthContext.logout() usa window.location.href = '/' (hard redirect)
    await expect(page).toHaveURL('/', { timeout: 15_000 });
  });

  test('logout remove a sessão do localStorage @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardPaciente);
    await logout(page);
    await expect(page).toHaveURL('/', { timeout: 15_000 });

    // rd.auth.session.v1 deve ter sido removido por clearStoredSession()
    const session = await page.evaluate(() =>
      window.localStorage.getItem('rd.auth.session.v1'),
    );
    expect(session).toBeNull();
  });

  test('após logout, rota protegida redireciona para /Entrar @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.dashboardPaciente);
    await logout(page);
    await expect(page).toHaveURL('/', { timeout: 15_000 });

    // Tenta acessar rota protegida com sessão já removida
    await goto(ROUTES.dashboardPaciente);
    await expect(page).toHaveURL(/Entrar/, { timeout: 10_000 });
  });

  test('logout limpa rd_last_active_consultation do sessionStorage', async ({
    page, goto,
  }) => {
    await goto(ROUTES.dashboardPaciente);

    // Injeta estado de consulta ativa no sessionStorage (simula consulta em andamento)
    await page.evaluate(() => {
      window.sessionStorage.setItem('rd_last_active_consultation', 'consulta-abc-123');
    });

    await logout(page);
    await expect(page).toHaveURL('/', { timeout: 15_000 });

    // AuthContext.clearClientState() remove este item
    const val = await page.evaluate(() =>
      window.sessionStorage.getItem('rd_last_active_consultation'),
    );
    expect(val).toBeNull();
  });

  test('botão "Minhas Consultas" aparece no menu quando logado', async ({ page, goto }) => {
    await goto(ROUTES.home);

    // Layout.jsx: DropdownMenuItem "Minhas Consultas" → /DashboardPaciente
    await openUserMenu(page);

    await expect(page.getByRole('menuitem', { name: 'Minhas Consultas' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Sair' })).toBeVisible();

    // Paciente NÃO deve ver "Área Profissional" (role=patient)
    await expect(page.getByRole('menuitem', { name: 'Área Profissional' })).not.toBeVisible();
  });

  test('deslogado: Layout mostra botão "Entrar" em vez do menu de usuário', async ({
    page, goto,
  }) => {
    await goto(ROUTES.dashboardPaciente);
    await logout(page);
    await expect(page).toHaveURL('/', { timeout: 15_000 });

    // Após logout, Layout mostra o botão "Entrar" para deslogados
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible();
  });

});

// ---------------------------------------------------------------------------
// Logout de profissional
// ---------------------------------------------------------------------------
test.describe('logout — profissional', () => {

  test.use({ storageState: AUTH_STATE.professional });

  test.beforeEach(async ({ page }, testInfo) => {
    void page;
    skipIfNoAuth(testInfo, 'professional');
  });

  test('profissional consegue fazer logout @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);

    await logout(page);

    const session = await page.evaluate(() =>
      window.localStorage.getItem('rd.auth.session.v1'),
    );
    expect(session).toBeNull();
  });

  test('menu do profissional exibe "Área Profissional"', async ({ page, goto }) => {
    await goto(ROUTES.home);

    await openUserMenu(page);

    // Layout.jsx: user.role === 'professional' → exibe "Área Profissional"
    await expect(page.getByRole('menuitem', { name: 'Área Profissional' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Sair' })).toBeVisible();
  });

});
