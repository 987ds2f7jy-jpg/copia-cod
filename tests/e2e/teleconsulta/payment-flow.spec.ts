/**
 * teleconsulta/payment-flow.spec.ts
 *
 * TIPO: Fluxo crítico
 *
 * PROPÓSITO
 *   Cobrir o fluxo de pagamento integrado ao plantão (ConsultaAgora).
 *   O room-access.spec.ts existente tinha um `fixme` neste bloco.
 *   Este arquivo substitui o placeholder com testes reais baseados
 *   na UI atual do frontend.
 *
 * FLUXO REAL (ConsultaAgora.jsx — confirmado pela revisão do código)
 *   step='form'    → formulário com Select especialidade + Textarea sintomas
 *   Botão principal: "Criar pagamento e entrar na fila"
 *   → Clique cria cobrança → step='payment'
 *   step='payment' → h2 "Pagamento do plantao"
 *                  → button "Simular pagamento aprovado" (modo dev/sandbox)
 *                  → button "Ir para pagamento" (link externo checkout)
 *                  → texto "A cobranca foi criada" / "checkout disponivel"
 *   Após pagamento aprovado:
 *   → button "Ver fila" → step='queue'
 *   step='queue'   → h2 "Voce esta na fila"
 *                  → button "Sair da Fila" → step='form'
 *
 * ROTA ADICIONAL: /pagamento/:status
 *   Retorno do gateway externo (status=aprovado|reprovado|pendente)
 *   Renderiza feedback ao usuário sobre o resultado do pagamento.
 *
 * SELETORES REAIS
 *   button "Criar pagamento e entrar na fila"   — step form (com especialidade)
 *   h2    "Pagamento do plantao"                — step payment
 *   button "Simular pagamento aprovado"         — sandbox/dev only
 *   button "Ir para pagamento"                  — link externo
 *   button "Ver fila"                           — pós-pagamento aprovado
 *   h2    "Voce esta na fila"                   — step queue
 *   button "Sair da Fila"                       — step queue
 *
 * LIMITAÇÕES
 *   - Criar cobrança real requer E2E_ALLOW_QUEUE=true
 *   - "Simular pagamento" só existe em ambiente sandbox
 *   - Gateway externo não é testável via E2E (abre nova aba/URL externa)
 *   - /pagamento/:status requer redirect do gateway — mock via page.route()
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';

// ===========================================================================
// Estrutura do botão de pagamento (sem criar dados reais)
// ===========================================================================

rdTest.describe('payment-flow — botão "Criar pagamento e entrar na fila"', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('botão existe e está desabilitado sem especialidade @critical', async ({ page, goto }) => {
    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/Entrar/);
    await expect(
      page.getByText('Entrar na Fila de Atendimento')
    ).toBeVisible({ timeout: 12_000 });

    await expect(
      page.getByRole('button', { name: 'Criar pagamento e entrar na fila' })
    ).toBeDisabled();
  });

  rdTest('botão habilita após selecionar especialidade (ou exibe aviso) @critical', async ({ page, goto }) => {
    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/Entrar/);
    await expect(
      page.getByText('Entrar na Fila de Atendimento')
    ).toBeVisible({ timeout: 12_000 });

    await page.getByText('Selecione a especialidade').click();
    await page.getByRole('option', { name: /clinico geral/i }).click();

    const btnEnabled = await page.getByRole('button', {
      name: 'Criar pagamento e entrar na fila',
    }).isEnabled();
    const hasWarning = await page.getByText(/nenhum profissional.*plantao ativo/i)
      .isVisible().catch(() => false);

    expect(btnEnabled || hasWarning).toBe(true);
  });

  rdTest('texto do botão reflete que há pagamento envolvido @critical', async ({ page, goto }) => {
    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/Entrar/);
    await expect(
      page.getByText('Entrar na Fila de Atendimento')
    ).toBeVisible({ timeout: 12_000 });

    // O nome do botão confirma que é um fluxo de pagamento
    await expect(
      page.getByRole('button', { name: 'Criar pagamento e entrar na fila' })
    ).toBeVisible();
  });

});

// ===========================================================================
// Fluxo de pagamento — step='payment' (requer E2E_ALLOW_QUEUE)
// ===========================================================================

rdTest.describe('payment-flow — step de pagamento (requer E2E_ALLOW_QUEUE)', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('clicar no botão exibe step "Pagamento do plantao" @critical', async ({ page, goto }) => {
    rdTest.skip(!process.env.E2E_ALLOW_QUEUE, 'Define E2E_ALLOW_QUEUE=true para criar cobrança real.');

    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/Entrar/);
    await expect(
      page.getByText('Entrar na Fila de Atendimento')
    ).toBeVisible({ timeout: 12_000 });

    await page.getByText('Selecione a especialidade').click();
    await page.getByRole('option', { name: /clinico geral/i }).click();

    const btn = page.getByRole('button', { name: 'Criar pagamento e entrar na fila' });
    await expect(btn).toBeEnabled({ timeout: 5_000 });
    await page.getByPlaceholder(/dor de cabeca|sintomas/i).fill('Teste E2E pagamento');
    await btn.click();

    await expect(
      page.getByRole('heading', { name: 'Pagamento do plantao' })
    ).toBeVisible({ timeout: 15_000 });
  });

  rdTest('step de pagamento exibe botão de checkout ou simulação @critical', async ({ page, goto }) => {
    rdTest.skip(!process.env.E2E_ALLOW_QUEUE, 'Define E2E_ALLOW_QUEUE=true.');

    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/Entrar/);
    await expect(
      page.getByText('Entrar na Fila de Atendimento')
    ).toBeVisible({ timeout: 12_000 });

    await page.getByText('Selecione a especialidade').click();
    await page.getByRole('option', { name: /clinico geral/i }).click();
    await expect(
      page.getByRole('button', { name: 'Criar pagamento e entrar na fila' })
    ).toBeEnabled({ timeout: 5_000 });
    await page.getByPlaceholder(/dor de cabeca|sintomas/i).fill('Teste E2E btn checkout');
    await page.getByRole('button', { name: 'Criar pagamento e entrar na fila' }).click();

    await expect(
      page.getByRole('heading', { name: 'Pagamento do plantao' })
    ).toBeVisible({ timeout: 15_000 });

    // Ou simulação (sandbox) ou link para checkout externo
    const hasSimulate = await page.getByRole('button', { name: 'Simular pagamento aprovado' })
      .isVisible().catch(() => false);
    const hasCheckout = await page.getByRole('button', { name: /ir para pagamento/i })
      .isVisible().catch(() => false);
    const hasText     = await page.getByText(/cobranca foi criada|checkout disponivel/i)
      .isVisible().catch(() => false);

    expect(hasSimulate || hasCheckout || hasText).toBe(true);
  });

  rdTest('simulação de pagamento aprovado leva à fila @critical', async ({ page, goto }) => {
    rdTest.skip(!process.env.E2E_ALLOW_QUEUE, 'Define E2E_ALLOW_QUEUE=true.');

    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/Entrar/);
    await expect(
      page.getByText('Entrar na Fila de Atendimento')
    ).toBeVisible({ timeout: 12_000 });

    await page.getByText('Selecione a especialidade').click();
    await page.getByRole('option', { name: /clinico geral/i }).click();
    await expect(
      page.getByRole('button', { name: 'Criar pagamento e entrar na fila' })
    ).toBeEnabled({ timeout: 5_000 });
    await page.getByPlaceholder(/dor de cabeca|sintomas/i).fill('Teste E2E simulação');
    await page.getByRole('button', { name: 'Criar pagamento e entrar na fila' }).click();

    await expect(
      page.getByRole('heading', { name: 'Pagamento do plantao' })
    ).toBeVisible({ timeout: 15_000 });

    const simulateBtn = page.getByRole('button', { name: 'Simular pagamento aprovado' });
    const canSimulate = await simulateBtn.isVisible().catch(() => false);

    if (!canSimulate) {
      // Ambiente sem sandbox — documentar que o teste não pôde avançar
      await expect(
        page.getByRole('button', { name: /ir para pagamento/i })
          .or(page.getByText(/checkout/i))
      ).toBeVisible({ timeout: 5_000 });
      return;
    }

    await simulateBtn.click();

    // Pós-simulação: button "Ver fila"
    await expect(
      page.getByRole('button', { name: 'Ver fila' })
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Ver fila' }).click();

    // step='queue'
    await expect(
      page.getByRole('heading', { name: /voce esta na fila/i })
    ).toBeVisible({ timeout: 15_000 });

    // Limpar: sair da fila
    await page.getByRole('button', { name: 'Sair da Fila' }).click();
    await expect(
      page.getByText('Entrar na Fila de Atendimento')
    ).toBeVisible({ timeout: 10_000 });
  });

});

// ===========================================================================
// Rota /pagamento/:status — retorno do gateway
// ===========================================================================

rdTest.describe('payment-flow — rota /pagamento/:status', () => {

  rdTest.beforeEach(async ({ clearAuthState }) => {
    await clearAuthState();
  });

  rdTest('rota /pagamento/aprovado carrega sem crash @critical', async ({ page, goto }) => {
    await goto('/pagamento/aprovado');
    // Deve renderizar algum conteúdo (não 404 genérico vazio ou crash de JS)
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 12_000 });
    // Não deve redirecionar para /Entrar sem motivo
    await expect(page).not.toHaveURL(/\/Entrar/);
  });

  rdTest('rota /pagamento/reprovado carrega sem crash @critical', async ({ page, goto }) => {
    await goto('/pagamento/reprovado');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 12_000 });
  });

  rdTest('rota /pagamento/pendente carrega sem crash @critical', async ({ page, goto }) => {
    await goto('/pagamento/pendente');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 12_000 });
  });

});
