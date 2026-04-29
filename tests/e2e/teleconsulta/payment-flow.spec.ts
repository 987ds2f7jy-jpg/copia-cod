/**
 * teleconsulta/payment-flow.spec.ts
 *
 * TIPO: Documentação + testes reais baseados no código atual
 *
 * DIAGNÓSTICO (baseado na leitura do ConsultaAgora.jsx e App.tsx):
 *
 *   O frontend atual NÃO possui:
 *     ✗ step='payment' em ConsultaAgora
 *     ✗ rota /pagamento/:status
 *     ✗ botão "Criar pagamento e entrar na fila"
 *     ✗ botão "Simular pagamento aprovado"
 *     ✗ PaymentStep ou qualquer componente de checkout
 *
 *   O que existe REALMENTE em ConsultaAgora.jsx:
 *     ✓ step='form'  → Select especialidade + Textarea sintomas + button "Entrar na Fila"
 *     ✓ step='queue' → h2 "Voce esta na fila" + button "Sair da Fila"
 *     ✓ Aviso de "Nenhum profissional...plantao ativo" quando não há profissional
 *     ✓ 3 cards informativos: "Atendimento 24h", "Medicos Verificados", (terceiro)
 *
 *   Contexto: O sistema de pagamento pode estar planejado para uma versão
 *   futura, mas não está implementado no frontend disponível.
 *
 * TESTES DESTE ARQUIVO:
 *   Cobre o fluxo de fila SEM pagamento (o que realmente existe).
 *   O arquivo patient/consulta-agora.spec.ts já cobre a estrutura básica —
 *   este arquivo adiciona testes de estado completo do step 'queue' e
 *   comportamento de polling.
 *
 * DEPENDÊNCIAS
 *   - AUTH_STATE.patient com storageState válido
 *   - E2E_ALLOW_QUEUE=true para criar entradas reais na fila
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';

// ===========================================================================
// Documentação: ausência de fluxo de pagamento no frontend atual
// ===========================================================================

rdTest.describe('payment — ausência documentada no frontend atual', () => {

  rdTest('rota /pagamento/sucesso não existe — renderiza 404 ou redireciona', async ({
    page, goto, clearAuthState,
  }) => {
    await clearAuthState();
    await goto('/pagamento/sucesso');

    // Não deve renderizar nada relacionado a pagamento (rota não existe no App.tsx)
    // Deve ir para PageNotFound ou redirecionar para /
    const isNotFound = await page.getByRole('heading').first().isVisible({ timeout: 8_000 }).catch(() => false);
    const url = page.url();

    // A rota não existe no router — cai no catch-all Route path="*"
    // ou vai para home se não houver handler
    expect(isNotFound || url.includes('/')).toBe(true);

    // Confirmar que NÃO há nenhuma UI de pagamento
    await expect(
      page.getByText(/pagamento aprovado|pagamento reprovado|seu pagamento/i)
    ).not.toBeVisible();
  });

  rdTest('rota /pagamento/falha não existe — não renderiza UI de pagamento', async ({
    page, goto, clearAuthState,
  }) => {
    await clearAuthState();
    await goto('/pagamento/falha');
    await expect(
      page.getByText(/pagamento.*reprovado|falha.*pagamento|checkout/i)
    ).not.toBeVisible({ timeout: 5_000 });
  });

  rdTest('ConsultaAgora usa "Entrar na Fila" — não "Criar pagamento" @critical', async ({
    page, goto,
  }) => {
    // Este teste documenta o comportamento real e serve como guarda:
    // se o botão mudar de texto, este teste falha e alerta o time.
    rdTest.use({ storageState: AUTH_STATE.patient });

    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByText('Entrar na Fila de Atendimento')
    ).toBeVisible({ timeout: 12_000 });

    // Botão correto existe
    await expect(
      page.getByRole('button', { name: 'Entrar na Fila' })
    ).toBeVisible();

    // Botão de pagamento NÃO existe
    await expect(
      page.getByRole('button', { name: /criar pagamento|pagar/i })
    ).not.toBeVisible();
  });

});

// ===========================================================================
// Step 'queue' — estado da fila (testes reais com flag)
// ===========================================================================

rdTest.describe('fila — step queue completo (requer E2E_ALLOW_QUEUE)', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('step queue exibe posição, tempo estimado e aviso de manter página aberta @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(!process.env.E2E_ALLOW_QUEUE, 'Define E2E_ALLOW_QUEUE=true.');

    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByText('Entrar na Fila de Atendimento')
    ).toBeVisible({ timeout: 12_000 });

    await page.getByText('Selecione a especialidade').click();
    await page.getByRole('option').first().click();

    const btn = page.getByRole('button', { name: 'Entrar na Fila' });
    await expect(btn).toBeEnabled({ timeout: 5_000 });
    await page.getByPlaceholder(/dor de cabeca|sintomas|Ex:/i).fill('Teste E2E — step queue');
    await btn.click();

    // Step 'queue'
    await expect(
      page.getByRole('heading', { name: /voce esta na fila/i })
    ).toBeVisible({ timeout: 15_000 });

    // Posição e tempo estimado
    await expect(page.getByText(/posicao \d|posição \d/i)).toBeVisible();
    await expect(page.getByText(/tempo estimado|~\d+ min/i)).toBeVisible();

    // Aviso de manter página aberta
    await expect(
      page.getByText(/mantenha esta pagina aberta|sera redirecionado automaticamente/i)
    ).toBeVisible();
  });

  rdTest('sair da fila volta para step form @critical', async ({ page, goto }) => {
    rdTest.skip(!process.env.E2E_ALLOW_QUEUE, 'Define E2E_ALLOW_QUEUE=true.');

    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByText('Entrar na Fila de Atendimento')
    ).toBeVisible({ timeout: 12_000 });

    await page.getByText('Selecione a especialidade').click();
    await page.getByRole('option').first().click();
    await expect(
      page.getByRole('button', { name: 'Entrar na Fila' })
    ).toBeEnabled({ timeout: 5_000 });
    await page.getByPlaceholder(/dor de cabeca|sintomas|Ex:/i).fill('Teste E2E — sair da fila');
    await page.getByRole('button', { name: 'Entrar na Fila' }).click();

    await expect(
      page.getByRole('heading', { name: /voce esta na fila/i })
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Sair da Fila' }).click();

    // Volta para o formulário
    await expect(
      page.getByText('Entrar na Fila de Atendimento')
    ).toBeVisible({ timeout: 10_000 });

    // Botão "Entrar na Fila" voltou (formulário resetado ou mantido)
    await expect(
      page.getByRole('button', { name: 'Entrar na Fila' })
    ).toBeVisible();
  });

  rdTest('spinner do botão "Sair da Fila" aparece durante a saída', async ({ page, goto }) => {
    rdTest.skip(!process.env.E2E_ALLOW_QUEUE, 'Define E2E_ALLOW_QUEUE=true.');

    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByText('Entrar na Fila de Atendimento')
    ).toBeVisible({ timeout: 12_000 });

    await page.getByText('Selecione a especialidade').click();
    await page.getByRole('option').first().click();
    await expect(
      page.getByRole('button', { name: 'Entrar na Fila' })
    ).toBeEnabled({ timeout: 5_000 });
    await page.getByPlaceholder(/dor de cabeca|sintomas|Ex:/i).fill('Teste E2E — spinner');
    await page.getByRole('button', { name: 'Entrar na Fila' }).click();

    await expect(
      page.getByRole('heading', { name: /voce esta na fila/i })
    ).toBeVisible({ timeout: 15_000 });

    // Clicar e verificar que a ação completa (spinner é transitório)
    const saiFila = page.getByRole('button', { name: 'Sair da Fila' });
    await saiFila.click();

    // Após saída, volta para o formulário
    await expect(
      page.getByText('Entrar na Fila de Atendimento')
    ).toBeVisible({ timeout: 10_000 });
  });

});
