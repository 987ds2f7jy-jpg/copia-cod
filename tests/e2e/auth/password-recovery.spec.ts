import { test, expect } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import type { Page } from '@playwright/test';

async function mockRecoveryEmailSuccess(page: Page) {
  await page.route('**/auth/v1/recover**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
}

test.describe('recuperação de senha', () => {
  test.beforeEach(async ({ clearAuthState }) => {
    await clearAuthState();
  });

  test('/RecuperarSenha abre como rota pública', async ({ page, goto }) => {
    await goto(ROUTES.recuperarSenha);

    await expect(page).toHaveURL(/\/RecuperarSenha/);
    await expect(page.getByRole('heading', { name: 'Recuperar senha' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: /Enviar link de recuperacao/i })).toBeVisible();
  });

  test('email vazio exibe mensagem amigável sem chamar Supabase Auth', async ({ page, goto }) => {
    let recoveryCalls = 0;
    await page.route('**/auth/v1/recover**', async (route) => {
      recoveryCalls += 1;
      await route.fulfill({ status: 500, body: '{}' });
    });

    await goto(ROUTES.recuperarSenha);
    await page.getByRole('button', { name: /Enviar link de recuperacao/i }).click();

    await expect(page.getByText('Informe um email valido.')).toBeVisible();
    expect(recoveryCalls).toBe(0);
  });

  test('email inválido usa validação nativa do campo', async ({ page, goto }) => {
    await goto(ROUTES.recuperarSenha);

    const emailInput = page.getByLabel('Email');
    await emailInput.fill('email-invalido');
    await page.getByRole('button', { name: /Enviar link de recuperacao/i }).click();

    await expect(page).toHaveURL(/\/RecuperarSenha/);
    await expect(emailInput).toHaveJSProperty('validity.valid', false);
  });

  test('solicitação de link mostra confirmação amigável', async ({ page, goto }) => {
    await mockRecoveryEmailSuccess(page);

    await goto(ROUTES.recuperarSenha);
    await page.getByLabel('Email').fill('paciente-e2e@rapidodoutor.test');
    await page.getByRole('button', { name: /Enviar link de recuperacao/i }).click();

    await expect(page.getByText(/enviamos um link de recuperacao/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('modo reset sem sessão de recuperação não quebra a UI', async ({ page, goto }) => {
    await goto(`${ROUTES.recuperarSenha}?mode=reset`);

    await expect(page.getByRole('heading', { name: 'Criar nova senha' })).toBeVisible();
    await expect(page.getByText(/Abra novamente o link enviado por email/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('button', { name: /Solicitar novo link/i })).toBeVisible();
  });
});
