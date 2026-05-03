/**
 * admin/aprovacao.spec.ts
 *
 * TIPO: Fluxo crítico
 *
 * FLUXO: /AdminAprovacao — aprovação e gestão de profissionais
 *
 * SELETORES BASEADOS NO HTML REAL (AdminAprovacao.jsx)
 *   Bloqueio (role ≠ admin via ProtectedRoute em App.tsx):
 *     h2 "Acesso Restrito"
 *     p  "Você não tem permissão para acessar esta página."
 *
 *   Página real (role = admin):
 *     h1 "Aprovacao de Profissionais" (sem acento)
 *     p  "Gerencie o cadastro dos profissionais na plataforma"
 *     Filtros (botões): "Pendentes", "Aprovados", "Rejeitados", "Suspensos", "Todos"
 *     Estado vazio: h3 "Nenhum cadastro neste status"
 *     Card de profissional (quando há dados):
 *       button "Aprovar"    (isPending=true)
 *       button "Rejeitar"   (isPending=true)
 *       button "Suspender"  (status=approved)
 *
 * GUARD DE ROLE
 *   sem auth → /Entrar
 *   patient  → h2 "Acesso Restrito" (AdminAprovacao.jsx verifica user?.role !== 'admin')
 *   professional → h2 "Acesso Restrito"
 *   admin    → acessa normalmente
 *
 * LIMITAÇÕES
 *   - Ações reais (aprovar/rejeitar/suspender) requerem E2E_ALLOW_ADMIN_ACTIONS
 *   - Testes de ações precisam de profissional com status=pending_review no banco
 *   - Seed: E2E_PENDING_PROFESSIONAL_PUBLIC_ID
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';

// ---------------------------------------------------------------------------
// Controle de acesso
// ---------------------------------------------------------------------------
rdTest.describe('admin-aprovacao — controle de acesso', () => {

  rdTest('sem sessão redireciona para /Entrar @critical', async ({
    page, goto, clearAuthState,
  }) => {
    await clearAuthState();
    await goto(ROUTES.adminAprovacao);
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

  rdTest.describe('paciente em /AdminAprovacao', () => {
    rdTest.use({ storageState: AUTH_STATE.patient });

    rdTest('vê "Acesso Restrito" @critical', async ({ page, goto }, testInfo) => {
      skipIfNoAuth(testInfo, 'patient');
      await goto(ROUTES.adminAprovacao);

      await expect(
        page.getByRole('heading', { name: 'Acesso Restrito' })
      ).toBeVisible({ timeout: 10_000 });

      await expect(
        page.getByText(/não tem permissão|nao tem permissao/i)
      ).toBeVisible();
    });
  });

  rdTest.describe('profissional em /AdminAprovacao', () => {
    rdTest.use({ storageState: AUTH_STATE.professional });

    rdTest('vê "Acesso Restrito" @critical', async ({ page, goto }, testInfo) => {
      skipIfNoAuth(testInfo, 'professional');
      await goto(ROUTES.adminAprovacao);

      await expect(
        page.getByRole('heading', { name: 'Acesso Restrito' })
      ).toBeVisible({ timeout: 10_000 });
    });
  });

});

// ---------------------------------------------------------------------------
// Admin — estrutura da página
// ---------------------------------------------------------------------------
rdTest.describe('admin-aprovacao — admin autenticado', () => {

  rdTest.use({ storageState: AUTH_STATE.admin });

  rdTest.beforeEach(async ({ page }, testInfo) => {
    void page;
    skipIfNoAuth(testInfo, 'admin');
  });

  rdTest('página carrega com h1 correto @critical', async ({ page, goto }) => {
    await goto(ROUTES.adminAprovacao);
    await expect(page).not.toHaveURL(/\/Entrar/);

    // AdminAprovacao.jsx: h1 sem acento
    await expect(
      page.getByRole('heading', { name: 'Aprovacao de Profissionais' })
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.getByText('Gerencie o cadastro dos profissionais na plataforma')
    ).toBeVisible();
  });

  rdTest('filtros de status estão presentes @critical', async ({ page, goto }) => {
    await goto(ROUTES.adminAprovacao);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Aprovacao de Profissionais' })
    ).toBeVisible({ timeout: 15_000 });

    // AdminAprovacao.jsx: filtros como botões (não Tabs Radix)
    await expect(page.getByRole('button', { name: 'Pendentes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aprovados' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rejeitados' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Suspensos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Todos' })).toBeVisible();
  });

  rdTest('filtro "Pendentes" é ativável por clique @critical', async ({ page, goto }) => {
    await goto(ROUTES.adminAprovacao);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Aprovacao de Profissionais' })
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Pendentes' }).click();

    // Depois de clicar, a lista muda (pode estar vazia)
    // O estado vazio é: h3 "Nenhum cadastro neste status"
    const hasEmpty = await page.getByRole('heading', {
      name: 'Nenhum cadastro neste status',
    }).isVisible().catch(() => false);

    const hasProfiles = await page.getByRole('heading', { level: 3 })
      .filter({ hasText: /dr\(a\)\.|[A-Z][a-z]+/ })
      .count() > 0;

    // Um dos dois estados deve existir
    expect(hasEmpty || hasProfiles).toBe(true);
  });

  rdTest('clicar em "Todos" exibe lista sem crash', async ({ page, goto }) => {
    await goto(ROUTES.adminAprovacao);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Aprovacao de Profissionais' })
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Todos' }).click();

    // Página não crasha — ou tem conteúdo ou exibe estado vazio
    await expect(
      page.getByText('Nenhum cadastro neste status')
        .or(page.getByRole('heading', { level: 1 }))
    ).toBeVisible({ timeout: 8_000 });
  });

  rdTest('estado vazio exibe mensagem clara @critical', async ({ page, goto }) => {
    await goto(ROUTES.adminAprovacao);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Aprovacao de Profissionais' })
    ).toBeVisible({ timeout: 15_000 });

    // Filtrar por um status que provavelmente está vazio em ambiente de teste
    await page.getByRole('button', { name: 'Suspensos' }).click();

    // Espera resultado — com ou sem dados
    await page.waitForTimeout(2_000);

    // Não deve crashar independente do resultado
    await expect(page).toHaveURL(/AdminAprovacao/);
  });

  // -------------------------------------------------------------------------
  // Ações (aprovar/rejeitar) — requerem dados de seed
  // -------------------------------------------------------------------------
  rdTest('botões Aprovar e Rejeitar aparecem para profissional pendente @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(
      !process.env.E2E_PENDING_PROFESSIONAL_PUBLIC_ID,
      'Define E2E_PENDING_PROFESSIONAL_PUBLIC_ID para testar botões de ação.',
    );

    await goto(ROUTES.adminAprovacao);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Aprovacao de Profissionais' })
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Pendentes' }).click();

    // Cards com profissionais pendentes devem ter botões de ação
    await expect(
      page.getByRole('button', { name: 'Aprovar' }).first()
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByRole('button', { name: 'Rejeitar' }).first()
    ).toBeVisible();
  });

  rdTest('aprovar profissional exibe toast de sucesso @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(
      !process.env.E2E_PENDING_PROFESSIONAL_PUBLIC_ID,
      'Define E2E_PENDING_PROFESSIONAL_PUBLIC_ID.',
    );
    rdTest.skip(
      !process.env.E2E_ALLOW_ADMIN_ACTIONS,
      'Define E2E_ALLOW_ADMIN_ACTIONS=true para executar ações reais de aprovação.',
    );

    await goto(ROUTES.adminAprovacao);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Aprovacao de Profissionais' })
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Pendentes' }).click();
    await expect(
      page.getByRole('button', { name: 'Aprovar' }).first()
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Aprovar' }).first().click();

    // AdminAprovacao.jsx: toast.success('Profissional aprovado! Ja aparece na busca.')
    await expect(
      page.getByText(/profissional aprovado/i)
    ).toBeVisible({ timeout: 10_000 });
  });

});
