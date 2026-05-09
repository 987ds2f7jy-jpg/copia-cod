/**
 * teleconsulta/pagamento-retorno.spec.ts
 *
 * TIPO: Fluxo crítico
 *
 * ROTA: /pagamento/:status — PagamentoRetorno.jsx
 *
 * SELETORES REAIS (PagamentoRetorno.jsx)
 *   ProtectedRoute → sem auth redireciona para /Entrar
 *   status="sucesso"  → h1 "Pagamento recebido pelo provedor"
 *                    → p  "A liberacao final acontece pelo webhook seguro do backend..."
 *                    → ícone CheckCircle (emerald)
 *   status="falha"    → h1 "Pagamento nao concluido"
 *                    → p  "O provedor nao confirmou o pagamento. Volte ao fluxo e tente novamente."
 *                    → ícone AlertTriangle (red)
 *   status="pendente" → h1 "Pagamento pendente"
 *                    → p  "O pagamento ainda esta em processamento..."
 *                    → ícone Clock (amber)
 *   status inválido   → fallback STATUS_CONFIG.pendente (mesmo que "pendente")
 *   button "Ver painel"       → navigate(createPageUrl('DashboardPaciente'))
 *   button "Voltar ao inicio" → navigate(createPageUrl('Home'))
 *
 * DEPENDÊNCIAS
 *   storageState de paciente para acessar a rota (ProtectedRoute)
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';

// ---------------------------------------------------------------------------
// Controle de acesso
// ---------------------------------------------------------------------------
rdTest.describe('pagamento-retorno — controle de acesso', () => {

  rdTest('sem auth /pagamento/sucesso redireciona para /Entrar @critical', async ({
    page, goto, clearAuthState,
  }) => {
    await clearAuthState();
    await goto(ROUTES.pagamentoRetorno('sucesso'));
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

  rdTest('sem auth /pagamento/falha redireciona para /Entrar @critical', async ({
    page, goto, clearAuthState,
  }) => {
    await clearAuthState();
    await goto(ROUTES.pagamentoRetorno('falha'));
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

  rdTest('sem auth /pagamento/pendente redireciona para /Entrar @critical', async ({
    page, goto, clearAuthState,
  }) => {
    await clearAuthState();
    await goto(ROUTES.pagamentoRetorno('pendente'));
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

  rdTest('rd_login_next salvo ao redirecionar @critical', async ({
    page, goto, clearAuthState,
  }) => {
    await clearAuthState();
    await goto(ROUTES.pagamentoRetorno('sucesso'));
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });

    const next = await page.evaluate(() =>
      window.sessionStorage.getItem('rd_login_next'),
    );
    expect(next).toContain('pagamento');
  });

});

// ---------------------------------------------------------------------------
// Variantes de status — headings e descrições
// ---------------------------------------------------------------------------
rdTest.describe('pagamento-retorno — variantes de status', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('/pagamento/sucesso exibe h1 e descrição corretos @critical', async ({ page, goto }) => {
    await goto(ROUTES.pagamentoRetorno('sucesso'));
    await expect(page).not.toHaveURL(/\/Entrar/);

    await expect(
      page.getByRole('heading', { name: 'Pagamento recebido pelo provedor' })
    ).toBeVisible({ timeout: 12_000 });

    await expect(
      page.getByText('A liberacao final acontece pelo webhook seguro do backend.')
    ).toBeVisible();
  });

  rdTest('/pagamento/falha exibe h1 e descrição corretos @critical', async ({ page, goto }) => {
    await goto(ROUTES.pagamentoRetorno('falha'));
    await expect(page).not.toHaveURL(/\/Entrar/);

    await expect(
      page.getByRole('heading', { name: 'Pagamento nao concluido' })
    ).toBeVisible({ timeout: 12_000 });

    await expect(
      page.getByText('O provedor nao confirmou o pagamento. Volte ao fluxo e tente novamente.')
    ).toBeVisible();
  });

  rdTest('/pagamento/pendente exibe h1 e descrição corretos @critical', async ({ page, goto }) => {
    await goto(ROUTES.pagamentoRetorno('pendente'));
    await expect(page).not.toHaveURL(/\/Entrar/);

    await expect(
      page.getByRole('heading', { name: 'Pagamento pendente' })
    ).toBeVisible({ timeout: 12_000 });

    await expect(
      page.getByText('O pagamento ainda esta em processamento.')
    ).toBeVisible();
  });

  rdTest('status inválido usa fallback de "pendente" @critical', async ({ page, goto }) => {
    await goto(ROUTES.pagamentoRetorno('status-invalido-e2e-9999'));
    await expect(page).not.toHaveURL(/\/Entrar/);

    // STATUS_CONFIG[status] || STATUS_CONFIG.pendente
    await expect(
      page.getByRole('heading', { name: 'Pagamento pendente' })
    ).toBeVisible({ timeout: 12_000 });
  });

});

// ---------------------------------------------------------------------------
// CTAs — presença e navegação
// ---------------------------------------------------------------------------
rdTest.describe('pagamento-retorno — botões de ação', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('sucesso: ambos os botões visíveis @critical', async ({ page, goto }) => {
    await goto(ROUTES.pagamentoRetorno('sucesso'));
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Pagamento recebido pelo provedor' })
    ).toBeVisible({ timeout: 12_000 });

    await expect(page.getByRole('button', { name: 'Ver painel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Voltar ao inicio' })).toBeVisible();
  });

  rdTest('falha: ambos os botões visíveis @critical', async ({ page, goto }) => {
    await goto(ROUTES.pagamentoRetorno('falha'));
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Pagamento nao concluido' })
    ).toBeVisible({ timeout: 12_000 });

    await expect(page.getByRole('button', { name: 'Ver painel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Voltar ao inicio' })).toBeVisible();
  });

  rdTest('pendente: ambos os botões visíveis @critical', async ({ page, goto }) => {
    await goto(ROUTES.pagamentoRetorno('pendente'));
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Pagamento pendente' })
    ).toBeVisible({ timeout: 12_000 });

    await expect(page.getByRole('button', { name: 'Ver painel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Voltar ao inicio' })).toBeVisible();
  });

  rdTest('"Ver painel" navega para /DashboardPaciente @critical', async ({ page, goto }) => {
    await goto(ROUTES.pagamentoRetorno('sucesso'));
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Pagamento recebido pelo provedor' })
    ).toBeVisible({ timeout: 12_000 });

    await page.getByRole('button', { name: 'Ver painel' }).click();
    await expect(page).toHaveURL(/DashboardPaciente/, { timeout: 10_000 });
  });

  rdTest('"Voltar ao inicio" navega para / @critical', async ({ page, goto }) => {
    await goto(ROUTES.pagamentoRetorno('falha'));
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Pagamento nao concluido' })
    ).toBeVisible({ timeout: 12_000 });

    await page.getByRole('button', { name: 'Voltar ao inicio' }).click();
    await expect(page).toHaveURL('/', { timeout: 10_000 });
  });

  rdTest('"Ver painel" na tela de falha também navega corretamente @critical', async ({ page, goto }) => {
    await goto(ROUTES.pagamentoRetorno('falha'));
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Pagamento nao concluido' })
    ).toBeVisible({ timeout: 12_000 });

    await page.getByRole('button', { name: 'Ver painel' }).click();
    await expect(page).toHaveURL(/DashboardPaciente/, { timeout: 10_000 });
  });

  rdTest('"Voltar ao inicio" na tela pendente navega para / @critical', async ({ page, goto }) => {
    await goto(ROUTES.pagamentoRetorno('pendente'));
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Pagamento pendente' })
    ).toBeVisible({ timeout: 12_000 });

    await page.getByRole('button', { name: 'Voltar ao inicio' }).click();
    await expect(page).toHaveURL('/', { timeout: 10_000 });
  });

});

// ---------------------------------------------------------------------------
// Profissional também pode acessar (ProtectedRoute sem requiredRole)
// ---------------------------------------------------------------------------
rdTest.describe('pagamento-retorno — acesso por role', () => {

  rdTest.use({ storageState: AUTH_STATE.professional });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'professional');
  });

  rdTest('profissional autenticado acessa /pagamento/sucesso sem bloqueio', async ({ page, goto }) => {
    await goto(ROUTES.pagamentoRetorno('sucesso'));
    await expect(page).not.toHaveURL(/\/Entrar/);

    // ProtectedRoute sem requiredRole — qualquer autenticado acessa
    await expect(
      page.getByRole('heading', { name: 'Pagamento recebido pelo provedor' })
    ).toBeVisible({ timeout: 12_000 });
  });

});
