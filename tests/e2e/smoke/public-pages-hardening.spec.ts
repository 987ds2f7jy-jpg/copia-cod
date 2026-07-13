import { test, expect } from '../support/fixtures';
import { ROUTES } from '../support/constants';

test.describe('regressao publica apos hardening', () => {
  test.beforeEach(async ({ clearAuthState }) => {
    await clearAuthState();
  });

  for (const pageDefinition of [
    { route: ROUTES.ajuda, heading: 'Central de Ajuda' },
    { route: ROUTES.termosDeUso, heading: 'Termos de Uso do Rápido Doutor' },
    { route: ROUTES.privacidade, heading: 'Aviso de Privacidade' },
  ]) {
    test(`${pageDefinition.route} permanece publica`, async ({ page, goto }) => {
      await goto(pageDefinition.route);

      await expect(page).not.toHaveURL(/\/Entrar/);
      await expect(page.getByRole('heading', { name: pageDefinition.heading, level: 1 }))
        .toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/Versão:/).first()).toBeVisible();
      await expect(page.getByText(/Vigência:/).first()).toBeVisible();
    });
  }

  test('documentos juridicos usam links reais', async ({ page, goto }) => {
    await goto(ROUTES.termosDeUso);
    const legalLinks = page.locator('a[href="/ajuda"], a[href="/termos-de-uso"], a[href="/privacidade"]');
    await expect(legalLinks.first()).toBeVisible();
    expect(await legalLinks.count()).toBeGreaterThan(0);
    expect(await page.locator('a[href="#"]').count()).toBe(0);
  });

  test('aviso de privacidade permanece legivel no modo escuro', async ({ page, goto }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await goto(ROUTES.privacidade);
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.getByRole('heading', { name: 'Aviso de Privacidade', level: 1 })).toBeVisible();
    await expect(page.getByText(/Este Aviso apresenta/).first()).toBeVisible();
  });

  test('banners publicos sao lidos pela Edge Function sem bloqueio de auth', async ({
    page,
    goto,
  }) => {
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/functions/v1/read-home-banners'),
    );

    await goto(ROUTES.home);
    const response = await responsePromise;

    expect(response.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });

  test('perfis publicos sao lidos por read-models sem bloqueio de auth', async ({
    page,
    goto,
  }) => {
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/functions/v1/read-models'),
    );

    await goto(ROUTES.especialidades);
    const response = await responsePromise;

    expect(response.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
