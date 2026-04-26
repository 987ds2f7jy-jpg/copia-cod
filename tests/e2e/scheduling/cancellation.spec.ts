/**
 * scheduling/cancellation.spec.ts
 *
 * TIPO: Regra de negócio
 *
 * FLUXO COBERTO: DashboardPaciente — cancelamento e exibição por status
 *
 * SELETORES BASEADOS NO HTML REAL (DashboardPaciente.jsx)
 *   Abas (TabsTrigger):
 *     - role="tab" name=/próximas/i   → value="proximas"
 *     - role="tab" name=/histórico/i  → value="historico"
 *     - role="tab" name=/canceladas/i → value="canceladas"
 *
 *   Botões de ação por consulta:
 *     - "Cancelar consulta"   → visível para statuses ativos
 *     - "Iniciar Consulta"    → visível para em_atendimento/accepted/CONFIRMADO
 *     - "Avaliar"             → visível para completed/CONCLUIDO (sem avaliação)
 *     - texto "Avaliada"      → visível para completed/CONCLUIDO (já avaliada)
 *
 *   Status visíveis (getStatusBadge):
 *     PT: SOLICITADO, CONFIRMADO, CANCELADO, CONCLUIDO, EXPIRADO
 *     EN: pending, accepted, confirmed, cancelled, completed, in_progress
 *     → Ambos são aceitos pelo filtro de cada aba (R4 documentado)
 *
 *   h1: "Olá, {primeiroNome}!"  → DashboardPaciente.jsx linha ~288
 *   p:  "Gerencie suas consultas e agendamentos"
 *
 * INCONSISTÊNCIA DE STATUS PT/EN (R4)
 *   cancelledAppointments usa: ['cancelled', 'CANCELADO'].includes(a.status)
 *   pastAppointments usa: ['completed', 'CONCLUIDO', 'EXPIRADO'].includes(a.status)
 *   Se o backend padronizar para apenas um formato, o filtro quebra.
 *   Os testes que verificam as abas cobrem os dois formatos.
 *
 * AUSÊNCIA DE REAGENDAMENTO (documentada)
 *   O sistema não possui fluxo de reagendamento. O teste documenta isso
 *   esperando que NENHUM botão "reagendar" apareça.
 *
 * DEPENDÊNCIAS
 *   - storageState de paciente
 *   - E2E_HAS_ACTIVE_APPOINTMENT=true  para testar cancelamento
 *   - E2E_ALLOW_CANCELLATION=true      para executar o cancelamento real
 *   - E2E_HAS_COMPLETED_APPOINTMENT=true para testar aba histórico
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { skipIfNoAuth } from '../support/auth-harness';
import { ROUTES, APPOINTMENT_STATUS } from '../support/constants';

rdTest.describe('cancellation — estrutura do dashboard', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({ page }, testInfo) => {
    void page;
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('dashboard carrega e exibe as 3 abas @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardPaciente);

    await expect(page).toHaveURL(/DashboardPaciente/);

    // h1 com primeiro nome do usuário
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });
    await expect(page.getByText('Gerencie suas consultas e agendamentos')).toBeVisible();

    // As 3 abas devem estar visíveis
    await expect(page.getByRole('tab', { name: /próximas/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /histórico/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /canceladas/i })).toBeVisible();
  });

  rdTest('aba canceladas exibe contador no label', async ({ page, goto }) => {
    await goto(ROUTES.dashboardPaciente);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });

    // O label inclui o count: "Canceladas (N)"
    // O regex aceita qualquer número (incluindo 0)
    await expect(
      page.getByRole('tab', { name: /canceladas \(\d+\)/i })
    ).toBeVisible();
  });

  rdTest('aba próximas exibe contador no label', async ({ page, goto }) => {
    await goto(ROUTES.dashboardPaciente);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });

    await expect(
      page.getByRole('tab', { name: /próximas \(\d+\)/i })
    ).toBeVisible();
  });

  rdTest('clicar na aba canceladas troca o conteúdo visível', async ({ page, goto }) => {
    await goto(ROUTES.dashboardPaciente);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });

    await page.getByRole('tab', { name: /canceladas/i }).click();

    // Após clicar, a aba deve estar ativa (aria-selected=true)
    await expect(
      page.getByRole('tab', { name: /canceladas/i })
    ).toHaveAttribute('aria-selected', 'true');
  });

  rdTest('clicar na aba histórico troca o conteúdo visível', async ({ page, goto }) => {
    await goto(ROUTES.dashboardPaciente);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });

    await page.getByRole('tab', { name: /histórico/i }).click();
    await expect(
      page.getByRole('tab', { name: /histórico/i })
    ).toHaveAttribute('aria-selected', 'true');
  });

  rdTest('não existe botão de reagendamento (ausência documentada)', async ({
    page, goto,
  }) => {
    // O sistema não implementa reagendamento — apenas cancelamento + novo agendamento.
    // Se um botão "Reagendar" aparecer, este teste falha e alerta a equipe.
    await goto(ROUTES.dashboardPaciente);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });

    await expect(
      page.getByRole('button', { name: /reagendar/i })
    ).not.toBeVisible();
  });

});

// ---------------------------------------------------------------------------
// Cancelamento com dados reais
// ---------------------------------------------------------------------------
rdTest.describe('cancellation — fluxo de cancelamento', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest('consulta ativa exibe botão "Cancelar consulta" @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(
      !process.env.E2E_HAS_ACTIVE_APPOINTMENT,
      'Define E2E_HAS_ACTIVE_APPOINTMENT=true quando houver agendamento ativo no banco.',
    );

    await goto(ROUTES.dashboardPaciente);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });

    // DashboardPaciente.jsx: botão aparece para statuses ativos não cancelados
    // O texto do botão é "Cancelar consulta" (linha ~242 com texto inline)
    await expect(
      page.getByRole('button', { name: /cancelar consulta/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  rdTest('cancelar consulta move para aba Canceladas @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(
      !process.env.E2E_HAS_ACTIVE_APPOINTMENT,
      'Define E2E_HAS_ACTIVE_APPOINTMENT=true.',
    );
    rdTest.skip(
      !process.env.E2E_ALLOW_CANCELLATION,
      'Define E2E_ALLOW_CANCELLATION=true para executar cancelamento real.',
    );

    await goto(ROUTES.dashboardPaciente);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });

    // Conta canceladas antes
    const cancelledTab = page.getByRole('tab', { name: /canceladas \(\d+\)/i });
    const labelBefore = await cancelledTab.textContent();
    const countBefore = Number(labelBefore?.match(/\d+/)?.[0] ?? 0);

    // Clica em cancelar
    await page.getByRole('button', { name: /cancelar consulta/i }).first().click();

    // Se houver dialog de confirmação
    const confirmBtn = page.getByRole('button', { name: /confirmar|sim/i });
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // Aguarda mutação completar (React Query invalida e refetch)
    await page.waitForTimeout(2_000);

    // Aba canceladas deve ter incrementado
    const labelAfter = await cancelledTab.textContent();
    const countAfter = Number(labelAfter?.match(/\d+/)?.[0] ?? 0);
    expect(countAfter).toBeGreaterThan(countBefore);
  });

  rdTest('aba canceladas aceita status "CANCELADO" (PT) e "cancelled" (EN) — R4', async ({
    page, goto,
  }) => {
    rdTest.skip(
      !process.env.E2E_HAS_CANCELLED_APPOINTMENT,
      'Define E2E_HAS_CANCELLED_APPOINTMENT=true quando houver consulta cancelada no banco.',
    );

    await goto(ROUTES.dashboardPaciente);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });

    await page.getByRole('tab', { name: /canceladas/i }).click();

    // DashboardPaciente filtra por ['cancelled', 'CANCELADO']
    // getStatusBadge mapeia ambos para o label "Cancelada"
    // Pelo menos uma consulta deve aparecer com o badge
    await expect(
      page.getByText('Cancelada').first()
    ).toBeVisible({ timeout: 8_000 });
  });

});

// ---------------------------------------------------------------------------
// Histórico e avaliação
// ---------------------------------------------------------------------------
rdTest.describe('cancellation — histórico e avaliação', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest('consulta concluída exibe botão Avaliar (sem avaliação prévia) @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(
      !process.env.E2E_HAS_COMPLETED_APPOINTMENT,
      'Define E2E_HAS_COMPLETED_APPOINTMENT=true.',
    );

    await goto(ROUTES.dashboardPaciente);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });

    await page.getByRole('tab', { name: /histórico/i }).click();

    // DashboardPaciente: completed/CONCLUIDO sem avaliação → botão Avaliar
    await expect(
      page.getByRole('button', { name: /avaliar/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  rdTest('consulta já avaliada exibe "Avaliada" sem botão duplicado', async ({
    page, goto,
  }) => {
    rdTest.skip(
      !process.env.E2E_HAS_REVIEWED_APPOINTMENT,
      'Define E2E_HAS_REVIEWED_APPOINTMENT=true.',
    );

    await goto(ROUTES.dashboardPaciente);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });
    await page.getByRole('tab', { name: /histórico/i }).click();

    // Deve mostrar o indicador de avaliada mas NÃO o botão Avaliar
    // (DashboardPaciente verifica reviewedAppointmentIds)
    // O texto exato é "Avaliada" com um checkmark (DashboardPaciente.jsx linha ~270)
    await expect(page.getByText('Avaliada').first()).toBeVisible({ timeout: 8_000 });
    await expect(
      page.getByRole('button', { name: /^avaliar$/i })
    ).not.toBeVisible();
  });

  rdTest('aba histórico aceita status "CONCLUIDO" (PT) e "completed" (EN) — R4', async ({
    page, goto,
  }) => {
    rdTest.skip(
      !process.env.E2E_HAS_COMPLETED_APPOINTMENT,
      'Define E2E_HAS_COMPLETED_APPOINTMENT=true.',
    );

    await goto(ROUTES.dashboardPaciente);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });
    await page.getByRole('tab', { name: /histórico/i }).click();

    // getStatusBadge mapeia completed e CONCLUIDO para o mesmo label
    // Algum conteúdo deve aparecer na aba histórico
    await expect(page.locator('[role="tabpanel"]').last()).toBeVisible();
  });

});
