/**
 * professional/disponibilidade.spec.ts
 *
 * ROTA: /DashboardProfissional -> aba Meu Perfil
 *
 * Valida o editor de disponibilidade sem salvar alteracoes reais na conta
 * compartilhada. A persistencia fica fora por padrao para evitar flake/dados
 * mutaveis entre execucoes.
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';
import { clickProfessionalTab, waitForProfessionalDashboard } from '../support/page-helpers';

async function openAvailabilityEditor(page: import('@playwright/test').Page, goto: (route: string) => Promise<void>) {
  await goto(ROUTES.dashboardProfissional);
  await waitForProfessionalDashboard(page);
  await clickProfessionalTab(page, 'perfil');
  await expect(page.getByRole('heading', { name: /disponibilidade por dia/i })).toBeVisible({
    timeout: 25_000,
  });
}

rdTest.describe('disponibilidade profissional - editor semanal', () => {
  rdTest.use({ storageState: AUTH_STATE.professional });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'professional');
  });

  rdTest('exibe sete dias, slots extremos e botao de salvar @critical', async ({
    page,
    goto,
  }) => {
    await openAvailabilityEditor(page, goto);

    for (const day of [
      /^Dom(?:\s|$)/i,
      /^Seg(?:\s|$)/i,
      /^Ter(?:\s|$)/i,
      /^Qua(?:\s|$)/i,
      /^Qui(?:\s|$)/i,
      /^Sex(?:\s|$)/i,
      /^S.b(?:\s|$)/i,
    ]) {
      await expect(page.getByRole('button', { name: day })).toBeVisible();
    }

    await expect(page.getByRole('button', { name: '08:00' })).toBeVisible();
    await expect(page.getByRole('button', { name: '17:40' })).toBeVisible();
    await expect(page.getByRole('button', { name: /salvar disponibilidade/i })).toBeVisible();
  });

  rdTest('clicar em um dia muda o estado ativo sem depender de classe CSS', async ({
    page,
    goto,
  }) => {
    await openAvailabilityEditor(page, goto);

    const domingo = page.getByRole('button', { name: /Dom/i });
    const segunda = page.getByRole('button', { name: /Seg/i });

    await domingo.click();
    await expect(domingo).toHaveAttribute('aria-pressed', 'true');
    await expect(segunda).toHaveAttribute('aria-pressed', 'false');
  });

  rdTest('slot de horario alterna selecao local e pode ser restaurado', async ({
    page,
    goto,
  }) => {
    await openAvailabilityEditor(page, goto);

    const slot = page.getByRole('button', { name: '08:00' });
    const initialState = await slot.getAttribute('aria-pressed');
    const toggledState = initialState === 'true' ? 'false' : 'true';

    await slot.click();
    await expect(slot).toHaveAttribute('aria-pressed', toggledState);

    await slot.click();
    await expect(slot).toHaveAttribute('aria-pressed', initialState ?? 'false');
  });

  rdTest('trocar de dia preserva a selecao local sem salvar no backend', async ({
    page,
    goto,
  }) => {
    await openAvailabilityEditor(page, goto);

    const segunda = page.getByRole('button', { name: /Seg/i });
    const domingo = page.getByRole('button', { name: /Dom/i });
    const slot = page.getByRole('button', { name: '08:00' });
    const initialState = await slot.getAttribute('aria-pressed');
    const toggledState = initialState === 'true' ? 'false' : 'true';

    await segunda.click();
    await slot.click();
    await expect(slot).toHaveAttribute('aria-pressed', toggledState);

    await domingo.click();
    await segunda.click();
    await expect(slot).toHaveAttribute('aria-pressed', toggledState);

    await slot.click();
    await expect(slot).toHaveAttribute('aria-pressed', initialState ?? 'false');
  });
});
