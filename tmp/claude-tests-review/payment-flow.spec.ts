/**
 * teleconsulta/payment-flow.spec.ts
 *
 * TIPO: Fluxo crítico
 *
 * ROTAS COBERTAS:
 *   /ConsultaAgora step='payment'  — step de pagamento após criar cobrança
 *   /pagamento/:status             — PagamentoRetorno.jsx (retorno do gateway)
 *
 * SELETORES REAIS
 *   ConsultaAgora.jsx step payment:
 *     PaymentStep title="Pagamento do plantao"
 *     PaymentStep description="Sua entrada na fila so fica ativa apos pagamento confirmado."
 *     PaymentStep continueLabel="Ver fila"
 *     PaymentStep paidTitle="Pagamento confirmado"
 *     button "Criar pagamento e entrar na fila"  ← botão real (não "Entrar na Fila")
 *
 *   PagamentoRetorno.jsx (/pagamento/:status):
 *     ProtectedRoute — requer autenticação
 *     sucesso  → h1 "Pagamento recebido pelo provedor"  + CheckCircle
 *     falha    → h1 "Pagamento nao concluido"           + AlertTriangle
 *     pendente → h1 "Pagamento pendente"                + Clock
 *     status inválido → fallback config de "pendente"
 *     button "Ver painel"      → navigate(DashboardPaciente)
 *     button "Voltar ao inicio" → navigate(Home)
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';

// ===========================================================================
// /pagamento/:status — PagamentoRetorno.jsx
// ===========================================================================

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

});

rdTest.describe('pagamento-retorno — variantes de status', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('/pagamento/sucesso — h1 correto e ícone de sucesso @critical', async ({ page, goto }) => {
    await goto(ROUTES.pagamentoRetorno('sucesso'));
    await expect(page).not.toHaveURL(/\/Entrar/);

    await expect(
      page.getByRole('heading', { name: 'Pagamento recebido pelo provedor' })
    ).toBeVisible({ timeout: 12_000 });

    await expect(
      page.getByText('A liberacao final acontece pelo webhook seguro do backend.')
    ).toBeVisible();
  });

  rdTest('/pagamento/falha — h1 correto @critical', async ({ page, goto }) => {
    await goto(ROUTES.pagamentoRetorno('falha'));
    await expect(page).not.toHaveURL(/\/Entrar/);

    await expect(
      page.getByRole('heading', { name: 'Pagamento nao concluido' })
    ).toBeVisible({ timeout: 12_000 });

    await expect(
      page.getByText('O provedor nao confirmou o pagamento.')
    ).toBeVisible();
  });

  rdTest('/pagamento/pendente — h1 correto @critical', async ({ page, goto }) => {
    await goto(ROUTES.pagamentoRetorno('pendente'));
    await expect(page).not.toHaveURL(/\/Entrar/);

    await expect(
      page.getByRole('heading', { name: 'Pagamento pendente' })
    ).toBeVisible({ timeout: 12_000 });

    await expect(
      page.getByText('O pagamento ainda esta em processamento.')
    ).toBeVisible();
  });

  rdTest('status desconhecido usa fallback "pendente" @critical', async ({ page, goto }) => {
    await goto(ROUTES.pagamentoRetorno('status-invalido-e2e'));
    await expect(page).not.toHaveURL(/\/Entrar/);

    // STATUS_CONFIG[status] || STATUS_CONFIG.pendente
    await expect(
      page.getByRole('heading', { name: 'Pagamento pendente' })
    ).toBeVisible({ timeout: 12_000 });
  });

  rdTest('todos os status têm botão "Ver painel" @critical', async ({ page, goto }) => {
    for (const status of ['sucesso', 'falha', 'pendente'] as const) {
      await goto(ROUTES.pagamentoRetorno(status));
      await expect(page).not.toHaveURL(/\/Entrar/);
      await expect(
        page.getByRole('button', { name: 'Ver painel' })
      ).toBeVisible({ timeout: 12_000 });
    }
  });

  rdTest('todos os status têm botão "Voltar ao inicio" @critical', async ({ page, goto }) => {
    for (const status of ['sucesso', 'falha', 'pendente'] as const) {
      await goto(ROUTES.pagamentoRetorno(status));
      await expect(page).not.toHaveURL(/\/Entrar/);
      await expect(
        page.getByRole('button', { name: 'Voltar ao inicio' })
      ).toBeVisible({ timeout: 12_000 });
    }
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

});

// ===========================================================================
// ConsultaAgora — step='payment' (requer E2E_ALLOW_QUEUE)
// ===========================================================================

rdTest.describe('consulta-agora — step payment (requer E2E_ALLOW_QUEUE)', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('clicar em "Criar pagamento e entrar na fila" exibe step de pagamento @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(!process.env.E2E_ALLOW_QUEUE, 'Define E2E_ALLOW_QUEUE=true.');

    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByText('Entrar na Fila de Atendimento')
    ).toBeVisible({ timeout: 12_000 });

    await page.getByText('Selecione a especialidade').click();
    await page.getByRole('option', { name: /clinico geral/i }).click();

    const btn = page.getByRole('button', { name: 'Criar pagamento e entrar na fila' });
    await expect(btn).toBeEnabled({ timeout: 5_000 });
    await page.getByPlaceholder(/dor de cabeca|sintomas/i).fill('Teste E2E — step payment');
    await btn.click();

    // PaymentStep title="Pagamento do plantao"
    await expect(
      page.getByRole('heading', { name: 'Pagamento do plantao' })
    ).toBeVisible({ timeout: 15_000 });

    // PaymentStep description
    await expect(
      page.getByText('Sua entrada na fila so fica ativa apos pagamento confirmado.')
    ).toBeVisible();
  });

  rdTest('step payment exibe opção de ir ao checkout ou simulação @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(!process.env.E2E_ALLOW_QUEUE, 'Define E2E_ALLOW_QUEUE=true.');

    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByText('Entrar na Fila de Atendimento')
    ).toBeVisible({ timeout: 12_000 });

    await page.getByText('Selecione a especialidade').click();
    await page.getByRole('option', { name: /clinico geral/i }).click();
    await expect(
      page.getByRole('button', { name: 'Criar pagamento e entrar na fila' })
    ).toBeEnabled({ timeout: 5_000 });
    await page.getByPlaceholder(/dor de cabeca|sintomas/i).fill('Teste E2E checkout');
    await page.getByRole('button', { name: 'Criar pagamento e entrar na fila' }).click();

    await expect(
      page.getByRole('heading', { name: 'Pagamento do plantao' })
    ).toBeVisible({ timeout: 15_000 });

    // PaymentStep pode ter: botão "Ir para pagamento" ou "Simular pagamento aprovado" (sandbox)
    const hasCheckout = await page.getByRole('button', { name: /ir para pagamento/i })
      .isVisible().catch(() => false);
    const hasSimulate = await page.getByRole('button', { name: 'Simular pagamento aprovado' })
      .isVisible().catch(() => false);

    expect(hasCheckout || hasSimulate).toBe(true);
  });

  rdTest('"Ver fila" aparece após pagamento aprovado (sandbox) @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(!process.env.E2E_ALLOW_QUEUE, 'Define E2E_ALLOW_QUEUE=true.');

    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByText('Entrar na Fila de Atendimento')
    ).toBeVisible({ timeout: 12_000 });

    await page.getByText('Selecione a especialidade').click();
    await page.getByRole('option', { name: /clinico geral/i }).click();
    await expect(
      page.getByRole('button', { name: 'Criar pagamento e entrar na fila' })
    ).toBeEnabled({ timeout: 5_000 });
    await page.getByPlaceholder(/dor de cabeca|sintomas/i).fill('Teste E2E ver fila');
    await page.getByRole('button', { name: 'Criar pagamento e entrar na fila' }).click();

    await expect(
      page.getByRole('heading', { name: 'Pagamento do plantao' })
    ).toBeVisible({ timeout: 15_000 });

    const simulateBtn = page.getByRole('button', { name: 'Simular pagamento aprovado' });
    if (!await simulateBtn.isVisible().catch(() => false)) {
      rdTest.skip(true, 'Ambiente sem sandbox — "Simular pagamento" não disponível.');
      return;
    }

    await simulateBtn.click();

    // continueLabel="Ver fila" após pagamento confirmado
    await expect(
      page.getByRole('button', { name: 'Ver fila' })
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Ver fila' }).click();

    await expect(
      page.getByRole('heading', { name: /voce esta na fila/i })
    ).toBeVisible({ timeout: 15_000 });

    // Cleanup: sair da fila
    await page.getByRole('button', { name: 'Sair da Fila' }).click();
    await expect(
      page.getByText('Entrar na Fila de Atendimento')
    ).toBeVisible({ timeout: 10_000 });
  });

});
