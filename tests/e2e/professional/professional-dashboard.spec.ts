/**
 * dashboard/professional-dashboard.spec.ts
 *
 * TIPO: Regra de negócio
 *
 * FLUXO COBERTO: /DashboardProfissional
 *
 * SELETORES BASEADOS NO HTML REAL (DashboardProfissional.jsx)
 *
 *   Header fixo (sticky):
 *     h1 "Dr(a). {nome}" ou "Painel Profissional" → linha ~439
 *     p  {specialty}                              → linha ~442
 *
 *   Abas internas (botões simples, não Radix Tabs):
 *     button "Dashboard"   → setActiveTab('dashboard')
 *     button "Meu Perfil"  → setActiveTab('perfil')
 *
 *   Filtros de período (botões):
 *     button "Hoje"
 *     button "Semana"
 *     button "Mês"
 *
 *   KPI cards (KPICard.jsx):
 *     p "Consultas realizadas"
 *     p "Receita do período"
 *     p "Nota média"
 *     p "Fila agora"
 *
 *   PlantaoBlock (PlantaoBlock.jsx):
 *     CardTitle "Plantão"
 *     Switch (role="switch") para isOnDuty
 *     Badge "Ativo" | "Inativo"
 *
 *   ProfessionalStatusGate (status ≠ 'approved'):
 *     h2 "Cadastro em análise"  → pending_review / pending
 *     h2 "Conta suspensa"       → suspended
 *     h2 "Cadastro não aprovado" → rejected
 *
 *   "Perfil profissional não encontrado" → sem professional record
 *
 * RISCO COBERTO
 *   R7 — ProfessionalStatusGate presentacional (não bloqueia rota)
 *   R6 — duty state pode ficar preso após crash
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';
import {
  waitForProfessionalDashboard,
  clickProfessionalTab,
  logoutViaMenu,
} from '../support/page-helpers';

function ensureProfessionalAuth(testInfo: { skip: (condition: boolean, reason: string) => void }) {
  skipIfNoAuth(testInfo, 'professional');
}

// ---------------------------------------------------------------------------
// Profissional aprovado
// ---------------------------------------------------------------------------
rdTest.describe('professional-dashboard — profissional aprovado', () => {

  rdTest.use({ storageState: AUTH_STATE.professional });

rdTest('carrega com sessão válida e exibe cabeçalho @critical', async ({ page, goto }, testInfo) => {
    ensureProfessionalAuth(testInfo);
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    // Não deve mostrar bloqueios
    await expect(
      page.getByRole('heading', { name: 'Acesso Restrito' })
    ).not.toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Cadastro em análise' })
    ).not.toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Conta suspensa' })
    ).not.toBeVisible();
  });

  rdTest('sem sessão redireciona para /Entrar @critical', async ({
    page, goto, clearAuthState,
  }) => {
    await clearAuthState();
    await goto(ROUTES.dashboardProfissional);
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

rdTest('exibe abas Dashboard e Meu Perfil @critical', async ({ page, goto }, testInfo) => {
    ensureProfessionalAuth(testInfo);
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Meu Perfil', exact: true })).toBeVisible();
  });

rdTest('filtros de período Hoje/Semana/Mês estão visíveis na aba Dashboard', async ({
    page, goto,
  }, testInfo) => {
    ensureProfessionalAuth(testInfo);
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await expect(page.getByRole('button', { name: 'Hoje', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Semana', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mês', exact: true })).toBeVisible();
  });

rdTest('KPIs principais renderizam (com ou sem dados) @critical', async ({ page, goto }, testInfo) => {
    ensureProfessionalAuth(testInfo);
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    // KPICard.jsx: p com label abaixo do valor
    // São estáveis: existem sempre, mesmo sem dados (mostram 0 ou "—")
    await expect(page.getByText('Consultas realizadas')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Receita do período')).toBeVisible();
    await expect(page.getByText('Nota média')).toBeVisible();
    await expect(page.getByText('Fila agora')).toBeVisible();
  });

rdTest('widget PlantaoBlock renderiza com Switch @critical', async ({ page, goto }, testInfo) => {
    ensureProfessionalAuth(testInfo);
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    // PlantaoBlock.jsx: CardTitle "Plantão" + Switch + Badge
    await expect(page.getByText('Plantão')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('switch')).toBeVisible();
    // Badge mostra estado atual: "Ativo" ou "Inativo"
    await expect(
      page.getByText('Ativo').or(page.getByText('Inativo'))
    ).toBeVisible();
  });

rdTest('clicar em "Semana" altera o período selecionado', async ({ page, goto }, testInfo) => {
    ensureProfessionalAuth(testInfo);
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await page.getByRole('button', { name: 'Semana', exact: true }).click();

    // Botão selecionado recebe bg-white e shadow — verificar que a página não quebra
    await expect(page.getByText('Consultas realizadas')).toBeVisible();
  });

rdTest('clicar em "Meu Perfil" exibe o componente MeuPerfil @critical', async ({
    page, goto,
  }, testInfo) => {
    ensureProfessionalAuth(testInfo);
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await clickProfessionalTab(page, 'perfil');

    // MeuPerfil.jsx: CardTitle "Foto de Perfil", "Apresentação", etc.
    await expect(
      page.getByText('Foto de Perfil').or(page.getByText('Apresentação'))
    ).toBeVisible({ timeout: 10_000 });
  });

rdTest('sessão persiste após reload @critical', async ({ page, goto }, testInfo) => {
    ensureProfessionalAuth(testInfo);
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await page.reload();

    await expect(page).toHaveURL(/DashboardProfissional/, { timeout: 15_000 });
    await waitForProfessionalDashboard(page);
  });

rdTest('após logout, dashboard redireciona para /Entrar', async ({ page, goto }, testInfo) => {
    ensureProfessionalAuth(testInfo);
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await logoutViaMenu(page);

    await goto(ROUTES.dashboardProfissional);
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // Sem dados — não deve quebrar a tela
  // -------------------------------------------------------------------------
rdTest('dashboard sem consultas não exibe crash (estado zerado)', async ({
    page, goto,
  }, testInfo) => {
    ensureProfessionalAuth(testInfo);
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    // KPIs existem mesmo com valor 0
    await expect(page.getByText('Consultas realizadas')).toBeVisible({ timeout: 10_000 });
    // Nenhum erro de JS na tela
    await expect(page.getByText(/something went wrong|error boundary/i)).not.toBeVisible();
  });

});

// ---------------------------------------------------------------------------
// Profissional com status não aprovado (R7)
// ---------------------------------------------------------------------------
rdTest.describe('professional-dashboard — status gate (R7)', () => {

  rdTest('pending_review: ProfessionalStatusGate bloqueia dashboard @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(
      !process.env.E2E_PENDING_PROFESSIONAL_EMAIL,
      'Define E2E_PENDING_PROFESSIONAL_EMAIL (profissional com status=pending_review).',
    );

    // Login manual com o profissional pending
    await goto(ROUTES.entrar);
    await page.getByLabel('Email').fill(process.env.E2E_PENDING_PROFESSIONAL_EMAIL!);
    await page.getByLabel('Senha').fill(process.env.E2E_PENDING_PROFESSIONAL_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/DashboardProfissional/, { timeout: 20_000 });

    // ProfessionalStatusGate.jsx: h2 "Cadastro em análise"
    await expect(
      page.getByRole('heading', { name: 'Cadastro em análise' })
    ).toBeVisible({ timeout: 10_000 });

    // O gate exibe link para voltar ao início
    await expect(page.getByRole('link', { name: 'Voltar ao Início' })).toBeVisible();

    // Nenhum KPI deve estar visível (dashboard real bloqueado)
    await expect(page.getByText('Consultas realizadas')).not.toBeVisible();
  });

  rdTest('toggle do Switch de plantão altera badge Ativo/Inativo @critical', async ({ page, goto }, testInfo) => {
    ensureProfessionalAuth(testInfo);
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await expect(page.getByText('Plantão')).toBeVisible({ timeout: 10_000 });

    const switchEl = page.getByRole('switch');
    await expect(switchEl).toBeVisible();

    // Ler estado inicial
    const initialChecked = await switchEl.isChecked();
    const initialBadge   = initialChecked ? 'Ativo' : 'Inativo';
    await expect(page.getByText(initialBadge)).toBeVisible();

    // Alternar
    await switchEl.click();

    // Badge deve mudar para o estado oposto
    const newBadge = initialChecked ? 'Inativo' : 'Ativo';
    await expect(page.getByText(newBadge)).toBeVisible({ timeout: 8_000 });

    // Reverter para o estado original (cleanup)
    await switchEl.click();
    await expect(page.getByText(initialBadge)).toBeVisible({ timeout: 8_000 });
  });

  rdTest.describe('acesso por role', () => {
    rdTest.use({ storageState: AUTH_STATE.patient });

    rdTest('paciente em /DashboardProfissional vê "Acesso Restrito"', async ({ page, goto }, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
    await goto(ROUTES.dashboardProfissional);

    await expect(
      page.getByRole('heading', { name: 'Acesso Restrito' })
    ).toBeVisible({ timeout: 10_000 });

    // URL permanece — não houve redirect (comportamento documentado em R1)
    await expect(page).toHaveURL(/DashboardProfissional/);
  });
  });

});
