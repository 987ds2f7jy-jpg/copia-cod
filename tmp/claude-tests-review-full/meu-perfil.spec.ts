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

// ===========================================================================
// Seções do perfil público
// ===========================================================================
rdTest.describe('meu-perfil — seções de conteúdo público', () => {

  rdTest.use({ storageState: AUTH_STATE.professional });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'professional');
  });

  rdTest('CardTitle "Público e Especialização" com botões de público atendido @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await clickProfessionalTab(page, 'perfil');
    await expect(page.getByText('Apresentação')).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText('Público e Especialização')).toBeVisible();
    await expect(page.getByText('Público atendido')).toBeVisible();
  });

  rdTest('CardTitle "Modalidade e Local" com campos de endereço @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await clickProfessionalTab(page, 'perfil');
    await expect(page.getByText('Apresentação')).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText('Modalidade e Local')).toBeVisible();
    // Campo de endereço
    await expect(page.getByPlaceholder('Rua / Avenida')).toBeVisible();
  });

  rdTest('CardTitle "Galeria do Consultório" presente @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await clickProfessionalTab(page, 'perfil');
    await expect(page.getByText('Apresentação')).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText('Galeria do Consultório')).toBeVisible();
  });

  rdTest('CardTitle "Valores das Consultas" com campos de preço @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await clickProfessionalTab(page, 'perfil');
    await expect(page.getByText('Apresentação')).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText('Valores das Consultas')).toBeVisible();
    await expect(page.getByText('Consulta Padrão (R$)')).toBeVisible();
    await expect(page.getByText('Consulta Prioritária (R$)')).toBeVisible();
    await expect(page.getByPlaceholder('150')).toBeVisible();
    await expect(page.getByPlaceholder('250')).toBeVisible();
  });

  rdTest('CardTitle "Controles de Visibilidade" presente @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await clickProfessionalTab(page, 'perfil');
    await expect(page.getByText('Apresentação')).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText('Controles de Visibilidade')).toBeVisible();
  });

  rdTest('link "Ver meu perfil público" existe na seção de cabeçalho @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await clickProfessionalTab(page, 'perfil');
    await expect(page.getByText('Apresentação')).toBeVisible({ timeout: 10_000 });

    // Link para /PerfilProfissional?id=...
    await expect(
      page.getByRole('link', { name: /ver meu perfil público/i })
        .or(page.getByRole('button', { name: /ver meu perfil público/i }))
    ).toBeVisible();
  });

  rdTest('preencher campo de preço padrão não desabilita o botão Salvar @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await clickProfessionalTab(page, 'perfil');
    await expect(page.getByText('Valores das Consultas')).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder('150').fill('180');

    await expect(
      page.getByRole('button', { name: 'Salvar Alterações' })
    ).toBeEnabled();
  });

  rdTest('salvar perfil exibe toast de sucesso (requer E2E_ALLOW_PROFILE_SAVE)', async ({
    page, goto,
  }) => {
    rdTest.skip(
      !process.env.E2E_ALLOW_PROFILE_SAVE,
      'Define E2E_ALLOW_PROFILE_SAVE=true para salvar perfil real.',
    );

    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await clickProfessionalTab(page, 'perfil');
    await expect(page.getByText('Apresentação')).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder(/escreva uma apresentacao/i).clear();
    await page.getByPlaceholder(/escreva uma apresentacao/i).fill('Perfil atualizado por E2E — ' + Date.now());
    await page.getByRole('button', { name: 'Salvar Alterações' }).click();

    await expect(
      page.getByText('Perfil atualizado! Visível na busca em instantes.')
    ).toBeVisible({ timeout: 12_000 });
  });

});
