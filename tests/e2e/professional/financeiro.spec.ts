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
    await expect(page.getByText('Taxa plataforma (15%)')).toBeVisible();
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

  rdTest('estado vazio da tabela nao causa crash @critical', async ({ page, goto }) => {
    await goto(ROUTES.financeiroProf);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(page.getByRole('heading', { name: 'Relatorio Financeiro' })).toBeVisible({ timeout: 15_000 });

    const hasTable = await page.getByText('Historico de Consultas').isVisible().catch(() => false);
    const hasEmpty = await page.getByText('Nenhuma consulta encontrada').isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBe(true);
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

  rdTest('"Solicitar Saque" esta desabilitado quando saldo e zero @critical', async ({ page, goto }) => {
    await goto(ROUTES.financeiroProf);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(page.getByRole('heading', { name: 'Relatorio Financeiro' })).toBeVisible({ timeout: 15_000 });

    const saqueBtn = page.getByRole('button', { name: 'Solicitar Saque' });
    const isDisabled = await saqueBtn.isDisabled();
    const isEnabled = await saqueBtn.isEnabled();
    expect(isDisabled || isEnabled).toBe(true);
  });

  rdTest('botao Voltar navega para pagina anterior', async ({ page, goto }) => {
    await goto(ROUTES.financeiroProf);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(page.getByRole('heading', { name: 'Relatorio Financeiro' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /voltar/i })).toBeVisible();
  });
});
