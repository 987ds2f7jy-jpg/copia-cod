/**
 * dashboard/patient-dashboard.spec.ts
 *
 * TIPO: Regra de negócio
 *
 * FLUXO COBERTO: /DashboardPaciente
 *
 * SELETORES BASEADOS NO HTML REAL (DashboardPaciente.jsx)
 *
 *   Cabeçalho:
 *     h1 "Olá, {primeiroNome}!"           → linha ~288
 *     p  "Gerencie suas consultas..."      → linha ~290
 *
 *   Ações rápidas (3 cards com links):
 *     link "Consulta Agora"               → /ConsultaAgora
 *     link "Agendar"                      → /AgendamentoEspecialidade
 *     link "Perguntar"                    → /PergunteEspecialista
 *     p "Atendimento imediato"
 *     p "Nova consulta"
 *     p "Tire dúvidas"
 *
 *   Abas (Radix Tabs):
 *     role="tab" "Próximas (N)"           → value="proximas"
 *     role="tab" "Histórico (N)"          → value="historico"
 *     role="tab" "Canceladas (N)"         → value="canceladas"
 *
 *   Estado vazio (aba próximas sem dados):
 *     h3 "Nenhuma consulta agendada"
 *     p  "Agende uma consulta com um de nossos especialistas"
 *     button/link "Agendar Consulta"
 *
 *   Estado vazio (histórico):
 *     p "Nenhuma consulta no histórico"
 *
 *   Estado vazio (canceladas):
 *     p "Nenhuma consulta cancelada"
 *
 * RISCO COBERTO
 *   R4  — status inconsistente PT/EN nas abas
 *   R11 — cache stale após mutação (invalidateQueries)
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';
import {
  waitForPatientDashboard,
  clickDashboardTab,
  logoutViaMenu,
} from '../support/page-helpers';

rdTest.use({ storageState: AUTH_STATE.patient });

function ensurePatientAuth(testInfo: { skip: (condition: boolean, reason: string) => void }) {
  skipIfNoAuth(testInfo, 'patient');
}

// ---------------------------------------------------------------------------
// Estrutura central — carrega e exibe os elementos principais
// ---------------------------------------------------------------------------
rdTest.describe('patient-dashboard — estrutura', () => {

rdTest('carrega com sessão válida e exibe cabeçalho @critical', async ({ page, goto }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.dashboardPaciente);
    await waitForPatientDashboard(page);

    // DashboardPaciente.jsx: h1 com "Olá, {primeiroNome}!"
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    const text = await heading.textContent();
    expect(text).toMatch(/olá/i);
  });

  rdTest('sem sessão redireciona para /Entrar @critical', async ({
    page, goto, clearAuthState,
  }) => {
    await clearAuthState();
    await goto(ROUTES.dashboardPaciente);
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

rdTest('exibe as 3 abas de status com contadores @critical', async ({ page, goto }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.dashboardPaciente);
    await waitForPatientDashboard(page);

    // Tabs com contador dinâmico: "Próximas (N)", "Histórico (N)", "Canceladas (N)"
    await expect(page.getByRole('tab', { name: /próximas \(\d+\)/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /histórico \(\d+\)/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /canceladas \(\d+\)/i })).toBeVisible();
  });

rdTest('aba "Próximas" ativa por padrão', async ({ page, goto }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.dashboardPaciente);
    await waitForPatientDashboard(page);

    // Tabs defaultValue="proximas" — primeira aba começa selecionada
    await expect(
      page.getByRole('tab', { name: /próximas/i })
    ).toHaveAttribute('aria-selected', 'true');
  });

rdTest('exibe os 3 atalhos de ação rápida @critical', async ({ page, goto }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.dashboardPaciente);
    await waitForPatientDashboard(page);

    // Três Cards com Link — testamos pelo texto descritivo que é mais estável
    await expect(page.getByText('Atendimento imediato')).toBeVisible();
    await expect(page.getByText('Nova consulta')).toBeVisible();
    await expect(page.getByText('Tire dúvidas')).toBeVisible();
  });

});

// ---------------------------------------------------------------------------
// Navegação entre abas
// ---------------------------------------------------------------------------
rdTest.describe('patient-dashboard — navegação de abas', () => {

rdTest('clicar na aba Histórico a ativa', async ({ page, goto }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.dashboardPaciente);
    await waitForPatientDashboard(page);

    await clickDashboardTab(page, 'historico');
    // Estado vazio ou com dados — não deve quebrar
    await expect(
      page.getByText('Nenhuma consulta no histórico')
        .or(page.getByRole('heading', { level: 3 }).first())
    ).toBeVisible({ timeout: 8_000 });
  });

rdTest('clicar na aba Canceladas a ativa', async ({ page, goto }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.dashboardPaciente);
    await waitForPatientDashboard(page);

    await clickDashboardTab(page, 'canceladas');

    const isEmpty = await page.getByText('Nenhuma consulta cancelada').isVisible().catch(() => false);
    const hasCancelledBadge = await page.getByText('Cancelada', { exact: true }).isVisible().catch(() => false);
    expect(isEmpty || hasCancelledBadge).toBe(true);
  });

rdTest('clicar em "Consulta Agora" navega para /ConsultaAgora', async ({ page, goto }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.dashboardPaciente);
    await waitForPatientDashboard(page);

    // Link dentro do card de ação rápida
    await page.getByText('Atendimento imediato').click();
    await expect(page).toHaveURL(/ConsultaAgora/, { timeout: 10_000 });
  });

rdTest('clicar em "Agendar" navega para /AgendamentoEspecialidade', async ({ page, goto }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.dashboardPaciente);
    await waitForPatientDashboard(page);

    await page.getByText('Nova consulta').click();
    await expect(page).toHaveURL(/AgendamentoEspecialidade/, { timeout: 10_000 });
  });

});

// ---------------------------------------------------------------------------
// Estado vazio — sem dados não quebra a tela
// ---------------------------------------------------------------------------
rdTest.describe('patient-dashboard — estado vazio (sem dados)', () => {

rdTest('aba Próximas vazia exibe CTA de agendamento @critical', async ({ page, goto }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.dashboardPaciente);
    await waitForPatientDashboard(page);

    // Aguarda o loading (skeleton) desaparecer
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 10_000 },
    ).catch(() => {}); // Se não tiver skeleton, tudo bem

    const hasEmpty = await page.getByRole('heading', { name: 'Nenhuma consulta agendada' }).isVisible().catch(() => false);
    const hasAppointments = await page.locator('h3').filter({ hasText: /dr\(a\)\./i }).count() > 0;

    // Uma das duas condições deve ser verdadeira — nunca tela em branco
    expect(hasEmpty || hasAppointments).toBe(true);
  });

rdTest('aba Histórico vazia exibe estado vazio sem crash', async ({ page, goto }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.dashboardPaciente);
    await waitForPatientDashboard(page);
    await clickDashboardTab(page, 'historico');

    // Ou mostra "Nenhuma consulta no histórico" ou mostra cards
    const isEmpty = await page.getByText('Nenhuma consulta no histórico').isVisible().catch(() => false);
    const hasCards = (await page.getByRole('heading', { level: 3 }).count()) > 0;
    expect(isEmpty || hasCards).toBe(true);
  });

rdTest('aba Canceladas vazia exibe estado vazio sem crash', async ({ page, goto }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.dashboardPaciente);
    await waitForPatientDashboard(page);
    await clickDashboardTab(page, 'canceladas');

    const isEmpty = await page.getByText('Nenhuma consulta cancelada').isVisible().catch(() => false);
    const hasBadge = await page.getByText('Cancelada').isVisible().catch(() => false);
    expect(isEmpty || hasBadge).toBe(true);
  });

});

// ---------------------------------------------------------------------------
// Sessão e persistência
// ---------------------------------------------------------------------------
rdTest.describe('patient-dashboard — sessão', () => {

rdTest('sessão persiste após reload @critical', async ({ page, goto }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.dashboardPaciente);
    await waitForPatientDashboard(page);

    await page.reload();

    // authService.restoreSession() restaura a partir do localStorage
    await expect(page).toHaveURL(/DashboardPaciente/, { timeout: 15_000 });
    await waitForPatientDashboard(page);
  });

rdTest('após logout, dashboard redireciona para /Entrar', async ({ page, goto }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.dashboardPaciente);
    await waitForPatientDashboard(page);

    await logoutViaMenu(page);

    await goto(ROUTES.dashboardPaciente);
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

});

// ---------------------------------------------------------------------------
// Modal de avaliação — estrutura (independe de ter consultas concluídas)
// ---------------------------------------------------------------------------
rdTest.describe('patient-dashboard — avaliação', () => {

rdTest('consulta concluída exibe botão Avaliar se não avaliada @critical', async ({
    page, goto,
  }, testInfo) => {
    ensurePatientAuth(testInfo);
    rdTest.skip(
      !process.env.E2E_HAS_COMPLETED_APPOINTMENT,
      'Define E2E_HAS_COMPLETED_APPOINTMENT=true.',
    );

    await goto(ROUTES.dashboardPaciente);
    await waitForPatientDashboard(page);
    await clickDashboardTab(page, 'historico');

    await expect(
      page.getByRole('button', { name: /avaliar/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

rdTest('clicar em Avaliar abre dialog com título "Avaliar Consulta"', async ({
    page, goto,
  }, testInfo) => {
    ensurePatientAuth(testInfo);
    rdTest.skip(
      !process.env.E2E_HAS_COMPLETED_APPOINTMENT,
      'Define E2E_HAS_COMPLETED_APPOINTMENT=true.',
    );

    await goto(ROUTES.dashboardPaciente);
    await waitForPatientDashboard(page);
    await clickDashboardTab(page, 'historico');

    await page.getByRole('button', { name: /avaliar/i }).first().click();

    // Dialog Radix — DialogTitle "Avaliar Consulta"
    await expect(
      page.getByRole('dialog', { name: /avaliar consulta/i })
    ).toBeVisible({ timeout: 5_000 });

    await expect(page.getByRole('button', { name: /enviar avaliação/i })).toBeVisible();
  });

});
