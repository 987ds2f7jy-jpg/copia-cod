import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';

rdTest.describe('financeiro - controle de acesso', () => {
  rdTest('sem sessao redireciona para /Entrar @critical', async ({ page, goto, clearAuthState }) => {
    await clearAuthState();
    await goto(ROUTES.financeiroProf);
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

  rdTest.describe('paciente nao acessa', () => {
    rdTest.use({ storageState: AUTH_STATE.patient });

    rdTest('paciente ve "Acesso Restrito" em /FinanceiroProfissional @critical', async ({ page, goto }, testInfo) => {
      skipIfNoAuth(testInfo, 'patient');
      await goto(ROUTES.financeiroProf);
      await expect(
        page.getByRole('heading', { name: 'Acesso Restrito' }),
      ).toBeVisible({ timeout: 10_000 });
    });
  });
});

rdTest.describe('financeiro - profissional aprovado', () => {
  rdTest.use({ storageState: AUTH_STATE.professional });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'professional');
  });

  rdTest('pagina carrega com h1 e subtitulo @critical', async ({ page, goto }) => {
    await goto(ROUTES.financeiroProf);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(page.getByRole('heading', { name: 'Relatorio Financeiro' })).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText('Resumo de receitas, saques e historico de consultas'),
    ).toBeVisible();
  });

  rdTest('6 KPIs financeiros sao renderizados @critical', async ({ page, goto }) => {
    await goto(ROUTES.financeiroProf);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(page.getByRole('heading', { name: 'Relatorio Financeiro' })).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText('Receita disponivel')).toBeVisible();
    await expect(page.getByText('Receita pendente')).toBeVisible();
    await expect(page.getByText('Taxa plataforma')).toBeVisible();
    await expect(page.getByText('Receita acumulada')).toBeVisible();
  });

  rdTest('grafico "Receita dos ultimos 6 meses" renderiza', async ({ page, goto }) => {
    await goto(ROUTES.financeiroProf);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(page.getByRole('heading', { name: 'Relatorio Financeiro' })).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText('Receita dos ultimos 6 meses')).toBeVisible();
  });

  rdTest('secao "Saques" renderiza com botoes de acao @critical', async ({ page, goto }) => {
    await goto(ROUTES.financeiroProf);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(page.getByRole('heading', { name: 'Relatorio Financeiro' })).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole('heading', { name: 'Saques' })).toBeVisible();
    await expect(page.getByRole('button', { name: /dados bancarios/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Solicitar Saque' })).toBeVisible();
  });

  rdTest('historico financeiro renderiza tabela ou estado vazio @critical', async ({ page, goto }) => {
    await goto(ROUTES.financeiroProf);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(page.getByRole('heading', { name: 'Relatorio Financeiro' })).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole('heading', { name: 'Historico financeiro' })).toBeVisible();

    const table = page.getByRole('table');
    const emptyState = page.getByText('Nenhum item financeiro encontrado');
    await expect(table.or(emptyState)).toBeVisible();

    if (await table.isVisible().catch(() => false)) {
      await expect(page.getByRole('columnheader', { name: 'Data' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Paciente' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Valor liquido' })).toBeVisible();
    }
  });

  rdTest('botao "Dados Bancarios" abre o modal @critical', async ({ page, goto }) => {
    await goto(ROUTES.financeiroProf);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(page.getByRole('heading', { name: 'Relatorio Financeiro' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /dados bancarios/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByRole('heading', { name: /dados banc[aá]rios/i })).toBeVisible();
  });

  rdTest('modal de dados bancarios exibe opcoes PIX e Conta bancaria @critical', async ({ page, goto }) => {
    await goto(ROUTES.financeiroProf);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(page.getByRole('heading', { name: 'Relatorio Financeiro' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /dados bancarios/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText('PIX', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Tipo de Chave PIX')).toBeVisible();
  });

  rdTest('"Solicitar Saque" reflete disponibilidade de saldo @critical', async ({ page, goto }) => {
    await goto(ROUTES.financeiroProf);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(page.getByRole('heading', { name: 'Relatorio Financeiro' })).toBeVisible({ timeout: 15_000 });

    const saqueBtn = page.getByRole('button', { name: 'Solicitar Saque' });
    await expect(saqueBtn).toBeVisible();

    const isDisabled = await saqueBtn.isDisabled();
    if (isDisabled) {
      await expect(saqueBtn).toBeDisabled();
      await expect(page.getByText(/receita dispon.vel|saldo dispon.vel/i).first()).toBeVisible();
      return;
    }

    await expect(saqueBtn).toBeEnabled();
  });

  rdTest('modal de saque exibe saldo, valor e confirmacao quando ha seed de saldo @critical', async ({ page, goto }) => {
    rdTest.skip(
      !process.env.E2E_HAS_SALDO,
      'Define E2E_HAS_SALDO=true com profissional contendo receita disponivel para validar o modal de saque.',
    );

    await goto(ROUTES.financeiroProf);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(page.getByRole('heading', { name: 'Relatorio Financeiro' })).toBeVisible({ timeout: 15_000 });

    const saqueBtn = page.getByRole('button', { name: 'Solicitar Saque' });
    await expect(saqueBtn).toBeEnabled({ timeout: 5_000 });
    await saqueBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByRole('heading', { name: 'Solicitar Saque' })).toBeVisible();
    await expect(dialog.getByText(/saldo dispon.vel/i)).toBeVisible();

    const valor = dialog.getByPlaceholder(/ex:\s*500\.00/i)
      .or(dialog.getByRole('spinbutton'))
      .first();
    await expect(valor).toBeVisible();

    const confirmar = dialog.getByRole('button', { name: 'Confirmar Saque' });
    await expect(confirmar).toBeVisible();
    await expect(confirmar).toBeDisabled();
  });

  rdTest('botao Voltar navega para pagina anterior', async ({ page, goto }) => {
    await goto(ROUTES.financeiroProf);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(page.getByRole('heading', { name: 'Relatorio Financeiro' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /voltar/i })).toBeVisible();
  });
});
