import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';
import { clickProfessionalTab, waitForProfessionalDashboard } from '../support/page-helpers';

const BIO_PLACEHOLDER = /conte sobre sua experi[êe]ncia, abordagem e como pode ajudar/i;
const APRESENTACAO_HEADING = /apresenta[cç][aã]o/i;
const DISPONIBILIDADE_HEADING = /disponibilidade por dia/i;

rdTest.describe('meu-perfil - acesso e estrutura', () => {
  rdTest.use({ storageState: AUTH_STATE.professional });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'professional');
  });

  rdTest('aba "Meu Perfil" esta visivel no DashboardProfissional @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await expect(
      page.getByRole('button', { name: 'Meu Perfil', exact: true }),
    ).toBeVisible();
  });

  rdTest('clicar em "Meu Perfil" exibe secao de foto e apresentacao @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await clickProfessionalTab(page, 'perfil');

    await expect(page.getByRole('heading', { name: 'Foto de Perfil' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: APRESENTACAO_HEADING })).toBeVisible({ timeout: 10_000 });
  });

  rdTest('secao "Apresentacao" com textarea de bio esta presente @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await clickProfessionalTab(page, 'perfil');

    await expect(
      page.getByRole('heading', { name: APRESENTACAO_HEADING }),
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.getByPlaceholder(BIO_PLACEHOLDER)).toBeVisible();
  });

  rdTest('botao "Salvar Alteracoes" existe na aba Meu Perfil @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await clickProfessionalTab(page, 'perfil');

    await expect(
      page.getByRole('heading', { name: APRESENTACAO_HEADING }),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByRole('button', { name: /salvar altera[cç][õo]es|salvar alteracoes/i }).first(),
    ).toBeVisible();
  });

  rdTest('secao "Disponibilidade" existe com controle de status @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await clickProfessionalTab(page, 'perfil');

    await expect(
      page.getByRole('heading', { name: APRESENTACAO_HEADING }),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByRole('heading', { name: DISPONIBILIDADE_HEADING }),
    ).toBeVisible({ timeout: 8_000 });
  });

  rdTest('editar bio e salvar exibe feedback de sucesso @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await clickProfessionalTab(page, 'perfil');

    const bioField = page.getByPlaceholder(BIO_PLACEHOLDER);
    await expect(bioField).toBeVisible({ timeout: 10_000 });

    await bioField.clear();
    await bioField.fill(`Profissional E2E - perfil de teste atualizado em ${new Date().toISOString()}`);

    await page.getByRole('button', { name: /salvar altera[cç][õo]es|salvar alteracoes/i }).first().click();

    await expect(
      page.getByText(/salvo|sucesso|perfil.*atualizado/i).or(
        page.getByRole('button', { name: /salvo!/i }),
      ),
    ).toBeVisible({ timeout: 12_000 });
  });

  rdTest('voltar para aba Dashboard preserva estado do perfil', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await clickProfessionalTab(page, 'perfil');
    await expect(
      page.getByRole('heading', { name: APRESENTACAO_HEADING }),
    ).toBeVisible({ timeout: 10_000 });

    await clickProfessionalTab(page, 'dashboard');
    await expect(page.getByText('Consultas realizadas')).toBeVisible({ timeout: 8_000 });

    await clickProfessionalTab(page, 'perfil');
    await expect(page.getByPlaceholder(BIO_PLACEHOLDER)).toBeVisible({ timeout: 8_000 });
  });
});
