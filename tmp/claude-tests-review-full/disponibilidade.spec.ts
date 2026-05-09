/**
 * professional/disponibilidade.spec.ts
 *
 * FLUXO: Aba "Meu Perfil" → DisponibilidadeEditor
 *
 * SELETORES REAIS (DisponibilidadeEditor.jsx)
 *   CardTitle "Disponibilidade Semanal"
 *   7 botões de dia: 'Dom' | 'Seg' | 'Ter' | 'Qua' | 'Qui' | 'Sex' | 'Sáb'
 *   Após clicar num dia: grid de botões de horário (format "HH:mm")
 *   Slot selecionado: bg-emerald-500 (ou aria/state)
 *   button "Salvar Disponibilidade"
 *   Toast success: "Disponibilidade salva!" (replaceAvailabilitySlotsRequest)
 *   Toast error: mensagem de erro da API
 *
 * ACESSO
 *   DashboardProfissional → aba "Meu Perfil" → DisponibilidadeEditor
 *
 * LIMITAÇÕES
 *   Salvar real chama replaceAvailabilitySlotsRequest → flag E2E_ALLOW_AVAILABILITY
 *   Sem a flag, apenas testamos UI (seleção, toggle, botão presente).
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';
import { waitForProfessionalDashboard, clickProfessionalTab } from '../support/page-helpers';
import { type Page } from '@playwright/test';

// Helper: abre a aba Meu Perfil e aguarda DisponibilidadeEditor
async function openDisponibilidade(page: Page) {
  await clickProfessionalTab(page, 'perfil');
  await expect(
    page.getByText('Disponibilidade Semanal')
  ).toBeVisible({ timeout: 10_000 });
}

// Helper: mock de erro na API de disponibilidade
async function mockDisponibilidadeError(page: Page) {
  await page.route('**/functions/v1/replace-availability-slots**', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Internal Server Error — E2E mock' }),
    });
  });
}

// ===========================================================================
// Estrutura e acesso
// ===========================================================================
rdTest.describe('disponibilidade — estrutura', () => {

  rdTest.use({ storageState: AUTH_STATE.professional });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'professional');
  });

  rdTest('CardTitle "Disponibilidade Semanal" visível na aba Meu Perfil @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await openDisponibilidade(page);

    await expect(page.getByText('Disponibilidade Semanal')).toBeVisible();
  });

  rdTest('7 botões de dia da semana estão presentes @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await openDisponibilidade(page);

    for (const label of ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
  });

  rdTest('botão "Salvar Disponibilidade" está presente @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await openDisponibilidade(page);

    await expect(
      page.getByRole('button', { name: 'Salvar Disponibilidade' })
    ).toBeVisible();
  });

});

// ===========================================================================
// Seleção de dias e slots
// ===========================================================================
rdTest.describe('disponibilidade — seleção de dias e horários', () => {

  rdTest.use({ storageState: AUTH_STATE.professional });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'professional');
  });

  rdTest('clicar em "Seg" exibe grid de slots de horário @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await openDisponibilidade(page);

    await page.getByRole('button', { name: 'Seg', exact: true }).click();

    // Grid de horários deve aparecer (formato HH:mm)
    await expect(
      page.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  rdTest('clicar num slot o seleciona (estado visual muda) @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await openDisponibilidade(page);

    await page.getByRole('button', { name: 'Seg', exact: true }).click();

    const firstSlot = page.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first();
    await expect(firstSlot).toBeVisible({ timeout: 5_000 });

    const slotText = await firstSlot.textContent();
    await firstSlot.click();

    // Slot selecionado ganha bg-emerald-500 (classe CSS)
    // Verificamos via aria-pressed se disponível, ou via class
    const isPressed = await firstSlot.evaluate((el) => {
      return el.className.includes('emerald') || el.getAttribute('aria-pressed') === 'true';
    });
    expect(isPressed).toBe(true);
  });

  rdTest('clicar num slot selecionado o deseleciona (toggle) @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await openDisponibilidade(page);

    await page.getByRole('button', { name: 'Ter', exact: true }).click();

    const slot = page.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first();
    await expect(slot).toBeVisible({ timeout: 5_000 });

    // Selecionar
    await slot.click();
    const afterSelect = await slot.evaluate((el) =>
      el.className.includes('emerald') || el.getAttribute('aria-pressed') === 'true',
    );
    expect(afterSelect).toBe(true);

    // Deselecionar
    await slot.click();
    const afterDeselect = await slot.evaluate((el) =>
      el.className.includes('emerald') || el.getAttribute('aria-pressed') === 'true',
    );
    expect(afterDeselect).toBe(false);
  });

  rdTest('trocar de dia preserva seleção do dia anterior @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await openDisponibilidade(page);

    // Selecionar Seg + 1 slot
    await page.getByRole('button', { name: 'Seg', exact: true }).click();
    const slot = page.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first();
    await expect(slot).toBeVisible({ timeout: 5_000 });
    await slot.click();

    // Trocar para Qua
    await page.getByRole('button', { name: 'Qua', exact: true }).click();
    await expect(
      page.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first()
    ).toBeVisible({ timeout: 5_000 });

    // Voltar para Seg — slot deve continuar selecionado
    await page.getByRole('button', { name: 'Seg', exact: true }).click();
    const slotAgain = page.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first();
    await expect(slotAgain).toBeVisible({ timeout: 5_000 });

    const stillSelected = await slotAgain.evaluate((el) =>
      el.className.includes('emerald') || el.getAttribute('aria-pressed') === 'true',
    );
    expect(stillSelected).toBe(true);
  });

  rdTest('slots cobrem o intervalo horário esperado (08:00–17:40) @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await openDisponibilidade(page);

    await page.getByRole('button', { name: 'Sex', exact: true }).click();
    await expect(
      page.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first()
    ).toBeVisible({ timeout: 5_000 });

    // Verificar slots extremos
    await expect(page.getByRole('button', { name: '08:00', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '17:40', exact: true })).toBeVisible();
  });

});

// ===========================================================================
// Salvar disponibilidade
// ===========================================================================
rdTest.describe('disponibilidade — salvar (requer E2E_ALLOW_AVAILABILITY)', () => {

  rdTest.use({ storageState: AUTH_STATE.professional });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'professional');
  });

  rdTest('salvar disponibilidade exibe toast "Disponibilidade salva!" @critical', async ({ page, goto }) => {
    rdTest.skip(
      !process.env.E2E_ALLOW_AVAILABILITY,
      'Define E2E_ALLOW_AVAILABILITY=true para salvar disponibilidade real.',
    );

    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await openDisponibilidade(page);

    // Selecionar Seg + 1 slot
    await page.getByRole('button', { name: 'Seg', exact: true }).click();
    const slot = page.getByRole('button', { name: '08:00', exact: true });
    await expect(slot).toBeVisible({ timeout: 5_000 });
    await slot.click();

    await page.getByRole('button', { name: 'Salvar Disponibilidade' }).click();

    await expect(
      page.getByText('Disponibilidade salva!')
    ).toBeVisible({ timeout: 12_000 });
  });

  rdTest('erro ao salvar exibe toast de erro (via mock de rede) @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    // Interceptar antes de navegar para a aba
    await mockDisponibilidadeError(page);
    await openDisponibilidade(page);

    await page.getByRole('button', { name: 'Seg', exact: true }).click();
    const slot = page.getByRole('button', { name: '08:00', exact: true });
    await expect(slot).toBeVisible({ timeout: 5_000 });
    await slot.click();

    await page.getByRole('button', { name: 'Salvar Disponibilidade' }).click();

    // Deve mostrar toast de erro
    await expect(
      page.getByText(/erro ao salvar|nao foi possivel/i)
    ).toBeVisible({ timeout: 12_000 });
  });

  rdTest('botão "Salvar Disponibilidade" mostra estado de loading durante envio @critical', async ({ page, goto }) => {
    rdTest.skip(
      !process.env.E2E_ALLOW_AVAILABILITY,
      'Define E2E_ALLOW_AVAILABILITY=true.',
    );

    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await openDisponibilidade(page);

    await page.getByRole('button', { name: 'Seg', exact: true }).click();
    const slot = page.getByRole('button', { name: '08:00', exact: true });
    await expect(slot).toBeVisible({ timeout: 5_000 });
    await slot.click();

    await page.getByRole('button', { name: 'Salvar Disponibilidade' }).click();

    // Durante o envio, botão fica disabled (isPending)
    await expect(
      page.getByRole('button', { name: 'Salvar Disponibilidade' })
    ).toBeDisabled({ timeout: 2_000 });

    // Após completar, toast aparece
    await expect(page.getByText('Disponibilidade salva!')).toBeVisible({ timeout: 12_000 });
  });

});
