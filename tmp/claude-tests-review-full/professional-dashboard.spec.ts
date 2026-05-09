import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';
import {
  waitForProfessionalDashboard,
  clickProfessionalTab,
  logoutViaMenu,
} from '../support/page-helpers';

function ensureProfessionalAuth(testInfo: { skip: (condition: boolean, reason: string) => void }) {
  skipIfNoAuth(testInfo, 'professional');
}

rdTest.describe('professional-dashboard - profissional aprovado', () => {
  rdTest.use({ storageState: AUTH_STATE.professional });

  rdTest('carrega com sessao valida e exibe cabecalho @critical', async ({ page, goto }, testInfo) => {
    ensureProfessionalAuth(testInfo);
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await expect(page.getByRole('heading', { name: 'Acesso Restrito' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cadastro em analise' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Conta suspensa' })).not.toBeVisible();
  });

  rdTest('sem sessao redireciona para /Entrar @critical', async ({ page, goto, clearAuthState }) => {
    await clearAuthState();
    await goto(ROUTES.dashboardProfissional);
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

  rdTest('exibe abas Dashboard e Meu Perfil @critical', async ({ page, goto }, testInfo) => {
    ensureProfessionalAuth(testInfo);
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Meu Perfil', exact: true })).toBeVisible();
  });

  rdTest('filtros de periodo Hoje/Semana/Mes estao visiveis na aba Dashboard', async ({ page, goto }, testInfo) => {
    ensureProfessionalAuth(testInfo);
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await expect(page.getByRole('button', { name: 'Hoje', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Semana', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^m[eê]s$/i })).toBeVisible();
  });

  rdTest('KPIs principais renderizam (com ou sem dados) @critical', async ({ page, goto }, testInfo) => {
    ensureProfessionalAuth(testInfo);
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await expect(page.getByText('Consultas realizadas')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/receita do per[íi]odo/i)).toBeVisible();
    await expect(page.getByText(/nota m[eé]dia/i)).toBeVisible();
    await expect(page.getByText('Fila agora')).toBeVisible();
  });

  rdTest('widget PlantaoBlock renderiza com Switch @critical', async ({ page, goto }, testInfo) => {
    ensureProfessionalAuth(testInfo);
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await expect(page.getByRole('heading', { name: /plant[aã]o/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('switch')).toBeVisible();
    await expect(page.getByText('Ativo').or(page.getByText('Inativo'))).toBeVisible();
  });

  rdTest('clicar em "Semana" altera o periodo selecionado', async ({ page, goto }, testInfo) => {
    ensureProfessionalAuth(testInfo);
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await page.getByRole('button', { name: 'Semana', exact: true }).click();
    await expect(page.getByText('Consultas realizadas')).toBeVisible();
  });

  rdTest('clicar em "Meu Perfil" exibe o componente MeuPerfil @critical', async ({ page, goto }, testInfo) => {
    ensureProfessionalAuth(testInfo);
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await clickProfessionalTab(page, 'perfil');

    await expect(page.getByRole('heading', { name: 'Foto de Perfil' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /apresenta[cç][aã]o/i })).toBeVisible({ timeout: 10_000 });
  });

  rdTest('sessao persiste apos reload @critical', async ({ page, goto }, testInfo) => {
    ensureProfessionalAuth(testInfo);
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await page.reload();

    await expect(page).toHaveURL(/DashboardProfissional/, { timeout: 15_000 });
    await waitForProfessionalDashboard(page);
  });

  rdTest('apos logout, dashboard redireciona para /Entrar', async ({ page, goto }, testInfo) => {
    ensureProfessionalAuth(testInfo);
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await logoutViaMenu(page);

    await goto(ROUTES.dashboardProfissional);
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

  rdTest('dashboard sem consultas nao exibe crash (estado zerado)', async ({ page, goto }, testInfo) => {
    ensureProfessionalAuth(testInfo);
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await expect(page.getByText('Consultas realizadas')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/something went wrong|error boundary/i)).not.toBeVisible();
  });

  rdTest('toggle do Switch de plantao altera badge Ativo/Inativo @critical', async ({ page, goto }, testInfo) => {
    ensureProfessionalAuth(testInfo);
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await expect(page.getByRole('heading', { name: /plant[aã]o/i })).toBeVisible({ timeout: 10_000 });

    const switchEl = page.getByRole('switch');
    await expect(switchEl).toBeVisible();

    const initialChecked = await switchEl.isChecked();
    const initialBadge = initialChecked ? 'Ativo' : 'Inativo';
    await expect(page.getByText(initialBadge)).toBeVisible();

    await switchEl.click();

    const newBadge = initialChecked ? 'Inativo' : 'Ativo';
    await expect(page.getByText(newBadge)).toBeVisible({ timeout: 8_000 });

    await switchEl.click();
    await expect(page.getByText(initialBadge)).toBeVisible({ timeout: 8_000 });
  });
});

rdTest.describe('professional-dashboard - status gate (R7)', () => {
  rdTest('pending_review: ProfessionalStatusGate bloqueia dashboard @critical', async ({ page, goto }) => {
    rdTest.skip(
      !process.env.E2E_PENDING_PROFESSIONAL_EMAIL,
      'Define E2E_PENDING_PROFESSIONAL_EMAIL (profissional com status=pending_review).',
    );

    await goto(ROUTES.entrar);
    await page.getByLabel('Email').fill(process.env.E2E_PENDING_PROFESSIONAL_EMAIL!);
    await page.getByLabel('Senha').fill(process.env.E2E_PENDING_PROFESSIONAL_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/DashboardProfissional/, { timeout: 20_000 });

    await expect(
      page.getByRole('heading', { name: 'Cadastro em analise' }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: 'Voltar ao Inicio' })).toBeVisible();
    await expect(page.getByText('Consultas realizadas')).not.toBeVisible();
  });

  rdTest.describe('acesso por role', () => {
    rdTest.use({ storageState: AUTH_STATE.patient });

    rdTest('paciente em /DashboardProfissional ve "Acesso Restrito"', async ({ page, goto }, testInfo) => {
      skipIfNoAuth(testInfo, 'patient');
      await goto(ROUTES.dashboardProfissional);

      await expect(
        page.getByRole('heading', { name: 'Acesso Restrito' }),
      ).toBeVisible({ timeout: 10_000 });
      await expect(page).toHaveURL(/DashboardProfissional/);
    });
  });
});
