import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';

rdTest.describe('payment-flow - botao "Criar pagamento e entrar na fila"', () => {
  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('botao existe e esta desabilitado sem especialidade @critical', async ({ page, goto }) => {
    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/Entrar/);
    await expect(page.getByText('Entrar na Fila de Atendimento')).toBeVisible({ timeout: 12_000 });

    await expect(
      page.getByRole('button', { name: 'Criar pagamento e entrar na fila' }),
    ).toBeDisabled();
  });

  rdTest('botao habilita apos selecionar especialidade (ou exibe aviso) @critical', async ({ page, goto }) => {
    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/Entrar/);
    await expect(page.getByText('Entrar na Fila de Atendimento')).toBeVisible({ timeout: 12_000 });

    await page.getByText('Selecione a especialidade').click();
    await page.getByRole('option', { name: /clinico geral/i }).click();

    const btnEnabled = await page.getByRole('button', {
      name: 'Criar pagamento e entrar na fila',
    }).isEnabled();
    const hasWarning = await page
      .getByText(/nenhum profissional.*plantao ativo/i)
      .isVisible()
      .catch(() => false);

    expect(btnEnabled || hasWarning).toBe(true);
  });

  rdTest('texto do botao reflete que ha pagamento envolvido @critical', async ({ page, goto }) => {
    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/Entrar/);
    await expect(page.getByText('Entrar na Fila de Atendimento')).toBeVisible({ timeout: 12_000 });

    await expect(
      page.getByRole('button', { name: 'Criar pagamento e entrar na fila' }),
    ).toBeVisible();
  });
});

rdTest.describe('payment-flow - step de pagamento (requer E2E_ALLOW_QUEUE)', () => {
  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('clicar no botao exibe step "Pagamento do plantao" @critical', async ({ page, goto }) => {
    rdTest.skip(!process.env.E2E_ALLOW_QUEUE, 'Define E2E_ALLOW_QUEUE=true para criar cobranca real.');

    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/Entrar/);
    await expect(page.getByText('Entrar na Fila de Atendimento')).toBeVisible({ timeout: 12_000 });

    await page.getByText('Selecione a especialidade').click();
    await page.getByRole('option', { name: /clinico geral/i }).click();

    const btn = page.getByRole('button', { name: 'Criar pagamento e entrar na fila' });
    await expect(btn).toBeEnabled({ timeout: 5_000 });
    await page.getByPlaceholder(/dor de cabeca|sintomas/i).fill('Teste E2E pagamento');
    await btn.click();

    await expect(
      page.getByRole('heading', { name: 'Pagamento do plantao' }),
    ).toBeVisible({ timeout: 15_000 });
  });

  rdTest('step de pagamento exibe botao de checkout ou simulacao @critical', async ({ page, goto }) => {
    rdTest.skip(!process.env.E2E_ALLOW_QUEUE, 'Define E2E_ALLOW_QUEUE=true.');

    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/Entrar/);
    await expect(page.getByText('Entrar na Fila de Atendimento')).toBeVisible({ timeout: 12_000 });

    await page.getByText('Selecione a especialidade').click();
    await page.getByRole('option', { name: /clinico geral/i }).click();
    await expect(
      page.getByRole('button', { name: 'Criar pagamento e entrar na fila' }),
    ).toBeEnabled({ timeout: 5_000 });
    await page.getByPlaceholder(/dor de cabeca|sintomas/i).fill('Teste E2E btn checkout');
    await page.getByRole('button', { name: 'Criar pagamento e entrar na fila' }).click();

    await expect(
      page.getByRole('heading', { name: 'Pagamento do plantao' }),
    ).toBeVisible({ timeout: 15_000 });

    const hasSimulate = await page
      .getByRole('button', { name: 'Simular pagamento aprovado' })
      .isVisible()
      .catch(() => false);
    const hasCheckout = await page
      .getByRole('button', { name: /ir para pagamento/i })
      .isVisible()
      .catch(() => false);
    const hasText = await page
      .getByText(/cobranca foi criada|checkout disponivel/i)
      .isVisible()
      .catch(() => false);

    expect(hasSimulate || hasCheckout || hasText).toBe(true);
  });

  rdTest('simulacao de pagamento aprovado leva a fila @critical', async ({ page, goto }) => {
    rdTest.skip(!process.env.E2E_ALLOW_QUEUE, 'Define E2E_ALLOW_QUEUE=true.');

    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/Entrar/);
    await expect(page.getByText('Entrar na Fila de Atendimento')).toBeVisible({ timeout: 12_000 });

    await page.getByText('Selecione a especialidade').click();
    await page.getByRole('option', { name: /clinico geral/i }).click();
    await expect(
      page.getByRole('button', { name: 'Criar pagamento e entrar na fila' }),
    ).toBeEnabled({ timeout: 5_000 });
    await page.getByPlaceholder(/dor de cabeca|sintomas/i).fill('Teste E2E simulacao');
    await page.getByRole('button', { name: 'Criar pagamento e entrar na fila' }).click();

    await expect(
      page.getByRole('heading', { name: 'Pagamento do plantao' }),
    ).toBeVisible({ timeout: 15_000 });

    const simulateBtn = page.getByRole('button', { name: 'Simular pagamento aprovado' });
    const canSimulate = await simulateBtn.isVisible().catch(() => false);

    if (!canSimulate) {
      await expect(
        page.getByRole('button', { name: /ir para pagamento/i }).or(
          page.getByText(/checkout/i),
        ),
      ).toBeVisible({ timeout: 5_000 });
      return;
    }

    await simulateBtn.click();
    await expect(page.getByRole('button', { name: 'Ver fila' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Ver fila' }).click();

    await expect(
      page.getByRole('heading', { name: /voce esta na fila/i }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Sair da Fila' }).click();
    await expect(page.getByText('Entrar na Fila de Atendimento')).toBeVisible({ timeout: 10_000 });
  });
});

rdTest.describe('payment-flow - rota /pagamento/:status', () => {
  rdTest('sem sessao, rota de pagamento redireciona para /Entrar @critical', async ({
    page, goto, clearAuthState,
  }) => {
    await clearAuthState();
    await goto('/pagamento/sucesso');
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

  rdTest.describe('com sessao de paciente', () => {
    rdTest.use({ storageState: AUTH_STATE.patient });

    rdTest.beforeEach(async ({}, testInfo) => {
      skipIfNoAuth(testInfo, 'patient');
    });

    rdTest('rota /pagamento/sucesso carrega sem crash @critical', async ({ page, goto }) => {
      await goto('/pagamento/sucesso');
      await expect(
        page.getByRole('heading', { name: 'Pagamento recebido pelo provedor' }),
      ).toBeVisible({ timeout: 12_000 });
      await expect(page).not.toHaveURL(/\/Entrar/);
    });

    rdTest('rota /pagamento/falha carrega sem crash @critical', async ({ page, goto }) => {
      await goto('/pagamento/falha');
      await expect(
        page.getByRole('heading', { name: 'Pagamento nao concluido' }),
      ).toBeVisible({ timeout: 12_000 });
    });

    rdTest('rota /pagamento/pendente carrega sem crash @critical', async ({ page, goto }) => {
      await goto('/pagamento/pendente');
      await expect(
        page.getByRole('heading', { name: 'Pagamento pendente' }),
      ).toBeVisible({ timeout: 12_000 });
    });
  });
});
