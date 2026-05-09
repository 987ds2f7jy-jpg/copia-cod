/**
 * teleconsulta/payment-flow.spec.ts
 *
 * TIPO: Fluxo crítico
 *
 * ROTA COBERTA: /ConsultaAgora step='payment'
 *   Testes da tela de pagamento dentro do fluxo de fila de plantão.
 *   Testes da rota /pagamento/:status estão em pagamento-retorno.spec.ts.
 *
 * SELETORES REAIS (ConsultaAgora.jsx + PaymentStep)
 *   CardTitle "Entrar na Fila de Atendimento"     — step form
 *   button "Criar pagamento e entrar na fila"      — submit do step form
 *   PaymentStep title="Pagamento do plantao"       — step payment heading
 *   PaymentStep description="Sua entrada na fila so fica ativa apos pagamento confirmado."
 *   button "Simular pagamento aprovado"            — sandbox only
 *   button "Ir para pagamento"                    — link externo checkout
 *   button "Ver fila"                             — continueLabel pós-pagamento
 *   h2 "Voce esta na fila"                        — step queue
 *   button "Sair da Fila"                         — step queue
 *
 * DEPENDÊNCIAS
 *   E2E_ALLOW_QUEUE=true para criar cobrança real
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';

rdTest.describe('payment-flow — step payment do ConsultaAgora', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('botão "Criar pagamento e entrar na fila" desabilitado sem especialidade @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByText('Entrar na Fila de Atendimento')
    ).toBeVisible({ timeout: 12_000 });

    await expect(
      page.getByRole('button', { name: 'Criar pagamento e entrar na fila' })
    ).toBeDisabled();
  });

  rdTest('botão habilita ao selecionar especialidade @critical', async ({ page, goto }) => {
    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByText('Entrar na Fila de Atendimento')
    ).toBeVisible({ timeout: 12_000 });

    await page.getByText('Selecione a especialidade').click();
    await page.getByRole('option', { name: /clinico geral/i }).click();

    const btnEnabled = await page
      .getByRole('button', { name: 'Criar pagamento e entrar na fila' })
      .isEnabled();
    const hasWarning = await page
      .getByText(/nenhum profissional.*plantao ativo/i)
      .isVisible()
      .catch(() => false);

    expect(btnEnabled || hasWarning).toBe(true);
  });

  rdTest('clicar no botão exibe step "Pagamento do plantao" @critical', async ({ page, goto }) => {
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

    await expect(
      page.getByRole('heading', { name: 'Pagamento do plantao' })
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.getByText('Sua entrada na fila so fica ativa apos pagamento confirmado.')
    ).toBeVisible();
  });

  rdTest('step payment exibe botão de checkout ou simulação @critical', async ({ page, goto }) => {
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

    const hasCheckout = await page
      .getByRole('button', { name: /ir para pagamento/i })
      .isVisible()
      .catch(() => false);
    const hasSimulate = await page
      .getByRole('button', { name: 'Simular pagamento aprovado' })
      .isVisible()
      .catch(() => false);

    expect(hasCheckout || hasSimulate).toBe(true);
  });

  rdTest('"Ver fila" aparece após pagamento aprovado → navega para step queue @critical', async ({
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

    await expect(
      page.getByRole('button', { name: 'Ver fila' })
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Ver fila' }).click();

    await expect(
      page.getByRole('heading', { name: /voce esta na fila/i })
    ).toBeVisible({ timeout: 15_000 });

    // Cleanup
    await page.getByRole('button', { name: 'Sair da Fila' }).click();
    await expect(
      page.getByText('Entrar na Fila de Atendimento')
    ).toBeVisible({ timeout: 10_000 });
  });

});
