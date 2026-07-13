import { expect } from '@playwright/test';
import { test } from '../support/fixtures';

test.describe('cookies e armazenamento', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('rapido_doutor_privacy_preferences_v1');
      window.localStorage.removeItem('rapido-doutor-theme');
    });
  });

  test('pagina publica e aviso oferecem escolhas equivalentes', async ({ page, goto }) => {
    await goto('/cookies-e-armazenamento');
    await expect(page.getByRole('heading', { name: 'Cookies e armazenamento', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aceitar opcionais' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rejeitar opcionais' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Configurar', exact: true })).toBeVisible();
    const hrefs = await page.locator('footer a').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(hrefs).not.toContain('#');
    expect(hrefs).toContain('/cookies-e-armazenamento');
  });

  test('rejeicao preserva tema e mantem opcionais desligados', async ({ page, goto }) => {
    await goto('/cookies-e-armazenamento');
    await expect(page.getByRole('button', { name: 'Rejeitar opcionais' })).toBeVisible();
    await page.evaluate(() => window.localStorage.setItem('rapido-doutor-theme', 'dark'));
    await page.getByRole('button', { name: 'Rejeitar opcionais' }).click();
    const state = await page.evaluate(() => ({
      theme: window.localStorage.getItem('rapido-doutor-theme'),
      preferences: JSON.parse(window.localStorage.getItem('rapido_doutor_privacy_preferences_v1') || '{}'),
    }));
    expect(state.theme).toBe('dark');
    expect(state.preferences).toMatchObject({ necessary: true, preferences: false, analytics: false, marketing: false });
  });

  test('permanece legivel em mobile e modo escuro', async ({ page, goto }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await goto('/cookies-e-armazenamento');
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.getByRole('heading', { name: 'Cookies e armazenamento', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rejeitar opcionais' })).toBeVisible();
  });
});
