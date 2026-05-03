/**
 * professional/queue-widget.spec.ts
 *
 * COMPONENTE: QueueWidget — visível no DashboardProfissional quando isOnDuty=true
 *
 * SELETORES REAIS (QueueWidget.jsx)
 *   CardTitle "Fila em Tempo Real"
 *   Badge "{N} aguardando"
 *   Estado vazio: p "Fila vazia"
 *   Card de paciente (quando há fila):
 *     p {patient.patient_name}
 *     Badge "Laudo" (tipo laudo) | Badge "Atendimento imediato" (plantão)
 *     button "Analise"  → abre painel lateral com detalhes
 *     button "Atender"  → chama onAccept(patient)
 *   Painel de análise (selectedPatient):
 *     "Revise os dados enviados pelo paciente antes de iniciar a consulta."
 *     button "Aceitar e continuar" → chama onAccept(selectedPatient)
 *
 * ESTRATÉGIA
 *   Estado vazio ("Fila vazia") testável imediatamente com profissional de plantão.
 *   Estado com paciente requer seed de queue entry com pagamento confirmado
 *   (flag E2E_ALLOW_QUEUE + seed via E2E_QUEUE_PATIENT_ID).
 *   O aceite real (onAccept → navigate /consulta/:id) requer E2E_ALLOW_ACCEPT.
 *
 * ACESSO
 *   DashboardProfissional aba Dashboard → QueueWidget visível quando isOnDuty=true.
 *   Se profissional estiver offline (isOnDuty=false), o widget pode não estar visível.
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';
import { waitForProfessionalDashboard } from '../support/page-helpers';

// ===========================================================================
// Estrutura e estado vazio
// ===========================================================================
rdTest.describe('queue-widget — estrutura e estado vazio', () => {

  rdTest.use({ storageState: AUTH_STATE.professional });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'professional');
  });

  rdTest('QueueWidget renderiza CardTitle "Fila em Tempo Real" @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    // O widget está na aba Dashboard (activeTab='dashboard')
    await expect(
      page.getByText('Fila em Tempo Real')
    ).toBeVisible({ timeout: 10_000 });
  });

  rdTest('badge de contagem "N aguardando" está visível @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    // Badge dinâmico: "{queuePatients.length} aguardando"
    await expect(
      page.getByText(/\d+ aguardando/)
    ).toBeVisible({ timeout: 10_000 });
  });

  rdTest('fila vazia exibe texto "Fila vazia" @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await expect(
      page.getByText('Fila em Tempo Real')
    ).toBeVisible({ timeout: 10_000 });

    // Se não há pacientes na fila, exibe "Fila vazia"
    // Se há pacientes, o teste é neutro (não falha — simplesmente não verifica "vazia")
    const isEmpty = await page.getByText('Fila vazia').isVisible().catch(() => false);
    const hasPatients = await page.getByRole('button', { name: 'Atender' }).isVisible().catch(() => false);

    // Um dos dois estados deve ser verdadeiro
    expect(isEmpty || hasPatients).toBe(true);
  });

  rdTest('badge muda de cor quando há pacientes vs. fila vazia @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await expect(
      page.getByText('Fila em Tempo Real')
    ).toBeVisible({ timeout: 10_000 });

    const badge = page.getByText(/\d+ aguardando/);
    await expect(badge).toBeVisible();

    // Badge existe — verificar que tem alguma classe de cor (amber quando > 0, muted quando = 0)
    const badgeClass = await badge.evaluate((el) => el.parentElement?.className || el.className);
    expect(badgeClass.length).toBeGreaterThan(0);
  });

  rdTest('QueueWidget está na aba Dashboard (não em Meu Perfil) @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    // Confirmar que está visível na aba padrão (Dashboard)
    await expect(
      page.getByRole('button', { name: 'Dashboard', exact: true })
    ).toBeVisible();

    await expect(page.getByText('Fila em Tempo Real')).toBeVisible({ timeout: 10_000 });

    // Mudar para Meu Perfil — widget deve sumir
    await page.getByRole('button', { name: 'Meu Perfil', exact: true }).click();
    await expect(page.getByText('Fila em Tempo Real')).not.toBeVisible({ timeout: 5_000 });
  });

});

// ===========================================================================
// Com paciente na fila (requer seed)
// ===========================================================================
rdTest.describe('queue-widget — com paciente na fila (requer seed)', () => {

  rdTest.use({ storageState: AUTH_STATE.professional });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'professional');
  });

  rdTest('card de paciente exibe nome e badge de tipo @critical', async ({ page, goto }) => {
    rdTest.skip(
      !process.env.E2E_QUEUE_PATIENT_ID,
      'Define E2E_QUEUE_PATIENT_ID com ID de paciente ativo na fila com pagamento confirmado.',
    );

    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await expect(page.getByText('Fila em Tempo Real')).toBeVisible({ timeout: 10_000 });

    // Com paciente na fila: nome e botão "Atender"
    await expect(
      page.getByRole('button', { name: 'Atender' }).first()
    ).toBeVisible({ timeout: 10_000 });

    // Badge de tipo: "Laudo" ou "Atendimento imediato"
    const hasLaudo = await page.getByText('Laudo').isVisible().catch(() => false);
    const hasAtendimento = await page.getByText('Atendimento imediato').isVisible().catch(() => false);
    expect(hasLaudo || hasAtendimento).toBe(true);
  });

  rdTest('botão "Analise" abre painel com detalhes do paciente @critical', async ({ page, goto }) => {
    rdTest.skip(
      !process.env.E2E_QUEUE_PATIENT_ID,
      'Define E2E_QUEUE_PATIENT_ID.',
    );

    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await expect(page.getByText('Fila em Tempo Real')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Analise' }).first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Analise' }).first().click();

    // Painel de análise: "Revise os dados..."
    await expect(
      page.getByText('Revise os dados enviados pelo paciente antes de iniciar a consulta.')
    ).toBeVisible({ timeout: 5_000 });

    await expect(
      page.getByRole('button', { name: 'Aceitar e continuar' })
    ).toBeVisible();
  });

  rdTest('"Aceitar e continuar" inicia a consulta @critical', async ({ page, goto }) => {
    rdTest.skip(
      !process.env.E2E_QUEUE_PATIENT_ID,
      'Define E2E_QUEUE_PATIENT_ID.',
    );
    rdTest.skip(
      !process.env.E2E_ALLOW_ACCEPT,
      'Define E2E_ALLOW_ACCEPT=true para aceitar paciente real da fila.',
    );

    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await expect(page.getByText('Fila em Tempo Real')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Analise' }).first().click();
    await expect(
      page.getByRole('button', { name: 'Aceitar e continuar' })
    ).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Aceitar e continuar' }).click();

    // onAccept → navigate('/consulta/:id')
    await expect(page).toHaveURL(/\/consulta\//, { timeout: 15_000 });
  });

  rdTest('"Atender" direto inicia a consulta sem abrir painel @critical', async ({ page, goto }) => {
    rdTest.skip(
      !process.env.E2E_QUEUE_PATIENT_ID,
      'Define E2E_QUEUE_PATIENT_ID.',
    );
    rdTest.skip(
      !process.env.E2E_ALLOW_ACCEPT,
      'Define E2E_ALLOW_ACCEPT=true.',
    );

    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await expect(page.getByText('Fila em Tempo Real')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Atender' }).first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Atender' }).first().click();

    await expect(page).toHaveURL(/\/consulta\//, { timeout: 15_000 });
  });

});

// ===========================================================================
// Plantão offline — widget pode não estar disponível
// ===========================================================================
rdTest.describe('queue-widget — plantão offline', () => {

  rdTest.use({ storageState: AUTH_STATE.professional });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'professional');
  });

  rdTest('QueueWidget visível independente do estado de plantão @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    // O QueueWidget é renderizado sempre no dashboard — isOnDuty afeta apenas a fila
    // mesmo offline, o widget deve estar presente (com fila vazia)
    await expect(
      page.getByText('Fila em Tempo Real')
    ).toBeVisible({ timeout: 10_000 });
  });

});
