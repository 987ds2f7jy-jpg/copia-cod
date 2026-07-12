/**
 * routing/access-control.spec.ts
 *
 * TIPO: Regra de negócio + Fluxo crítico
 *
 * PROPÓSITO
 *   Verificar que cada rota respeita seu nível de proteção: pública,
 *   autenticada, ou restrita por role. Cobre a inconsistência arquitetural
 *   do projeto (algumas rotas protegidas em App.tsx, outras internamente),
 *   garantindo que qualquer regressão em qualquer camada seja detectada.
 *
 * SELETORES BASEADOS NO HTML REAL
 *   ProtectedRoute (requiredRole errado):
 *     → <h2>Acesso Restrito</h2>  (ProtectedRoute.jsx linha ~21)
 *     → <p>Você não tem permissão…</p>
 *   AdminAprovacao (user.role !== 'admin'):
 *     → <h2>Acesso Restrito</h2>  (AdminAprovacao.jsx linha ~73)
 *     → <p>Esta pagina e exclusiva para administradores.</p>
 *   AgendamentoPerfil (user.role === 'professional'):
 *     → <h2>Ação não permitida</h2>  (AgendamentoPerfil.jsx linha ~155)
 *     → "Para agendar uma consulta, crie ou utilize uma conta de paciente."
 *   ProfessionalStatusGate (status !== 'approved'):
 *     → <h2>Cadastro em análise</h2> ou <h2>Conta suspensa</h2>
 *
 * RISCO COBERTO
 *   R1 — proteção de rota inconsistente (App.tsx vs interna)
 *   R7 — profissional não aprovado acessa dashboard
 *   R8 — profissional tenta agendar consulta
 */

import { test, expect } from '../support/fixtures';
import { AUTH_STATE } from '../support/fixtures';
import { skipIfNoAuth } from '../support/auth-harness';
import { openUserMenu } from '../support/page-helpers';
import {
  ROUTES,
  PUBLIC_ROUTES,
  AUTH_REQUIRED_ROUTES,
  PATIENT_ROUTES,
} from '../support/constants';

// ---------------------------------------------------------------------------
// Rotas públicas — sem auth, sem redirect
// ---------------------------------------------------------------------------
test.describe('acesso público — rotas acessíveis sem login', () => {

  for (const route of PUBLIC_ROUTES) {
    test(`${route} carrega sem autenticação`, async ({ page, goto, clearAuthState }) => {
      await clearAuthState();
      await goto(route);

      // Rotas públicas devem permanecer acessíveis sem auth.
      if (route === ROUTES.entrar) {
        await expect(page).toHaveURL(/\/Entrar/, { timeout: 8_000 });
        return;
      }

      await expect(page).not.toHaveURL(/\/Entrar/, { timeout: 8_000 });
    });
  }

  test('PerfilProfissional carrega sem login', async ({ page, goto, clearAuthState }) => {
    await clearAuthState();
    await goto(ROUTES.perfilProfissional);

    // Renderiza loader ou "não encontrado" — nunca redireciona para login
    await expect(page).not.toHaveURL(/\/Entrar/);
  });

});

// ---------------------------------------------------------------------------
// Rotas autenticadas — sem auth devem redirecionar e salvar rd_login_next
// ---------------------------------------------------------------------------
test.describe('acesso autenticado — sem sessão redireciona para /Entrar', () => {

  for (const route of AUTH_REQUIRED_ROUTES) {
    test(`${route} → /Entrar sem sessão @critical`, async ({
      page, goto, clearAuthState,
    }) => {
      await clearAuthState();
      await goto(route);

      await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });

      // ProtectedRoute salva a rota original para retomada pós-login
      const loginNext = await page.evaluate(() =>
        window.sessionStorage.getItem('rd_login_next'),
      );
      expect(loginNext).toBeTruthy();
      expect(loginNext).toContain(route);
    });
  }

  test('/FinanceiroProfissional sem sessão → /Entrar @critical', async ({
    page, goto, clearAuthState,
  }) => {
    await clearAuthState();
    await goto(ROUTES.financeiroProf);
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

  test('/consulta/:id sem sessão → /Entrar @critical', async ({
    page, goto, clearAuthState,
  }) => {
    await clearAuthState();
    await goto(ROUTES.consultaRoom('id-qualquer-e2e'));
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

  test('/AdminAprovacao sem sessão → /Entrar @critical', async ({
    page, goto, clearAuthState,
  }) => {
    await clearAuthState();
    await goto(ROUTES.adminAprovacao);
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

});

// ---------------------------------------------------------------------------
// Controle por role — paciente tenta acessar rotas de profissional/admin
// ---------------------------------------------------------------------------
test.describe('controle de acesso — paciente em rotas restritas', () => {

  test.use({ storageState: AUTH_STATE.patient });

  test.beforeEach(async ({ page }, testInfo) => {
    void page;
    skipIfNoAuth(testInfo, 'patient');
  });

  test('paciente em /DashboardProfissional vê "Acesso Restrito" @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.dashboardProfissional);

    // ProtectedRoute.jsx: requiredRole="professional", user.role="patient"
    // → renderiza <h2>Acesso Restrito</h2>, URL não muda
    await expect(page.getByRole('heading', { name: 'Acesso Restrito' }))
      .toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/não tem permissão/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /voltar ao início/i })).toBeVisible();

    // URL permanece — não houve redirect (comportamento intencional documentado)
    await expect(page).toHaveURL(/DashboardProfissional/);
  });

  test('paciente em /FinanceiroProfissional vê "Acesso Restrito" @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.financeiroProf);

    await expect(page.getByRole('heading', { name: 'Acesso Restrito' }))
      .toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/FinanceiroProfissional/);
  });

  test('paciente em /AdminAprovacao vê tela de acesso restrito @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.adminAprovacao);

    // App.tsx protege a rota via ProtectedRoute antes da tela interna.
    await expect(page.getByRole('heading', { name: 'Acesso Restrito' }))
      .toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/não tem permissão|nao tem permissao/i)).toBeVisible();
    await expect(page).toHaveURL(/AdminAprovacao/);
  });

  test('botão "Voltar ao início" na tela de bloqueio navega para home', async ({
    page, goto,
  }) => {
    await goto(ROUTES.dashboardProfissional);
    await expect(page.getByRole('heading', { name: 'Acesso Restrito' }))
      .toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /voltar ao início/i }).click();
    await expect(page).toHaveURL(ROUTES.home, { timeout: 8_000 });
  });

  for (const { route, expected } of [
    { route: ROUTES.dashboardPaciente, expected: /olá|ola/i },
    { route: ROUTES.perfil, expected: /Meu perfil/i },
    { route: ROUTES.consultaAgora, expected: /Consulta Agora/i },
    { route: ROUTES.laudosMedicos, expected: /Laudos Medicos/i },
    { route: ROUTES.solicitacaoExames, expected: /Solicitacao de Exames/i },
    { route: ROUTES.renovacaoReceitas, expected: /Renovacao de Receitas/i },
    { route: ROUTES.agendamentoEspecialidade, expected: /Agendamento por Especialidade/i },
    { route: ROUTES.agendamentoPerfil, expected: /Profissional não encontrado|Profissional nao encontrado/i },
    { route: ROUTES.pagamentoStatus('sucesso'), expected: /Pagamento nao identificado/i },
  ]) {
    test(`paciente autenticado acessa ${route} sem cair no login`, async ({
      page, goto,
    }) => {
      expect(PATIENT_ROUTES).toContain(route as typeof PATIENT_ROUTES[number]);
      await goto(route);

      await expect(page).not.toHaveURL(/\/Entrar/);
      await expect(page.getByRole('heading', { name: expected }).first())
        .toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('heading', { name: 'Acesso Restrito' })).not.toBeVisible();
    });
  }

});

// ---------------------------------------------------------------------------
// Controle por role — profissional em rotas de paciente
// ---------------------------------------------------------------------------
test.describe('controle de acesso — profissional em rotas de agendamento', () => {

  test.use({ storageState: AUTH_STATE.professional });

  test.beforeEach(async ({ page }, testInfo) => {
    void page;
    skipIfNoAuth(testInfo, 'professional');
  });

  test('profissional em /AgendamentoPerfil vê "Ação não permitida" @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.agendamentoPerfil + '?professional=qualquer-id');

    // AgendamentoPerfil.jsx: if (user?.role === 'professional') → h2 "Ação não permitida"
    await expect(page.getByRole('heading', { name: 'Ação não permitida' }))
      .toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/conta de paciente/i)).toBeVisible();
  });

  test('profissional em /AgendamentoEspecialidade vê "Ação não permitida" @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.agendamentoEspecialidade);

    await expect(page.getByRole('heading', { name: 'Ação não permitida' }))
      .toBeVisible({ timeout: 10_000 });
  });

  test('profissional em /DashboardPaciente ve "Acesso Restrito" @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.dashboardPaciente);

    await expect(page).toHaveURL(/DashboardPaciente/);
    await expect(page.getByRole('heading', { name: 'Acesso Restrito' }))
      .toBeVisible({ timeout: 10_000 });
  });

  test('profissional aprovado acessa /DashboardProfissional sem bloqueio @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.dashboardProfissional);

    // Não deve mostrar "Acesso Restrito" (role correto)
    await expect(page.getByRole('heading', { name: 'Acesso Restrito' }))
      .not.toBeVisible({ timeout: 10_000 });

    // Não deve mostrar ProfessionalStatusGate (profissional aprovado)
    await expect(page.getByRole('heading', { name: 'Cadastro em análise' }))
      .not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Conta suspensa' }))
      .not.toBeVisible();
  });

  test('profissional aprovado acessa /FinanceiroProfissional sem bloqueio @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.financeiroProf);

    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(page.getByRole('heading', { name: 'Acesso Restrito' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Relatorio Financeiro' }))
      .toBeVisible({ timeout: 15_000 });
  });

  test('profissional em /AdminAprovacao vê tela de acesso restrito @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.adminAprovacao);

    await expect(page.getByRole('heading', { name: 'Acesso Restrito' }))
      .toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/não tem permissão|nao tem permissao/i)).toBeVisible();
  });

  test('menu do Layout mostra "Área Profissional" para profissional', async ({
    page, goto,
  }) => {
    await goto(ROUTES.home);

    await openUserMenu(page);

    // Layout.jsx: user.role === 'professional' → exibe "Área Profissional"
    await expect(page.getByRole('menuitem', { name: 'Área Profissional' })).toBeVisible();

    // NÃO deve mostrar "Aprovar Profissionais" (apenas admin)
    await expect(page.getByRole('menuitem', { name: 'Aprovar Profissionais' }))
      .not.toBeVisible();
  });

});

// ---------------------------------------------------------------------------
// Controle por role — admin
// ---------------------------------------------------------------------------
test.describe('controle de acesso — admin', () => {

  test.use({ storageState: AUTH_STATE.admin });

  test.beforeEach(async ({ page }, testInfo) => {
    void page;
    skipIfNoAuth(testInfo, 'admin');
  });

  test('admin acessa /AdminAprovacao sem bloqueio @critical', async ({ page, goto }) => {
    await goto(ROUTES.adminAprovacao);

    await expect(page).toHaveURL(/AdminAprovacao/);

    // Não deve ver a tela de bloqueio
    await expect(page.getByText(/exclusiva para administradores/i)).not.toBeVisible();

    // AdminAprovacao.jsx linha ~87: h1 "Aprovacao de Profissionais"
    await expect(
      page.getByRole('heading', { name: /aprovação de profissionais|aprovacao/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('menu do admin mostra "Aprovar Profissionais"', async ({ page, goto }) => {
    await goto(ROUTES.home);

    await openUserMenu(page);

    // Layout.jsx: user.role === 'admin' → exibe "Aprovar Profissionais"
    await expect(page.getByRole('menuitem', { name: 'Aprovar Profissionais' })).toBeVisible();
  });

});

// ---------------------------------------------------------------------------
// Persistência de sessão entre navegações
// ---------------------------------------------------------------------------
test.describe('persistência de sessão', () => {

  test.use({ storageState: AUTH_STATE.patient });

  test.beforeEach(async ({ page }, testInfo) => {
    void page;
    skipIfNoAuth(testInfo, 'patient');
  });

  test('sessão persiste ao navegar entre rotas protegidas', async ({ page, goto }) => {
    // Navega entre múltiplas rotas protegidas — sessão nunca deve cair
    await goto(ROUTES.dashboardPaciente);
    await expect(page).toHaveURL(/DashboardPaciente/);
    await expect(page).not.toHaveURL(/Entrar/);

    await goto(ROUTES.perfil);
    await expect(page).toHaveURL(/Perfil/);
    await expect(page).not.toHaveURL(/Entrar/);

    // Sessão ainda presente no localStorage
    const session = await page.evaluate(() =>
      window.localStorage.getItem('rd.auth.session.v1'),
    );
    expect(session).not.toBeNull();
  });

  test('sessão persiste após reload da página', async ({ page, goto }) => {
    await goto(ROUTES.dashboardPaciente);
    await expect(page).toHaveURL(/DashboardPaciente/);

    // Reload duro — React Query e contexto são recriados do localStorage
    await page.reload();

    // authService.restoreSession() lê o localStorage e restaura o usuário
    await expect(page).toHaveURL(/DashboardPaciente/, { timeout: 15_000 });
    await expect(page).not.toHaveURL(/Entrar/);
  });

});
