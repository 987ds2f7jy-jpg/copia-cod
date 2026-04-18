/**
 * smoke/critical-paths.spec.ts
 *
 * TIPO: Smoke tests
 *
 * PROPÓSITO
 *   Verificar em menos de 2 minutos que os caminhos mais críticos do
 *   sistema ainda funcionam. São os primeiros a rodar em CI e os primeiros
 *   a quebrar quando algo sério dá errado.
 *
 * REGRAS
 *   - Sem login. Sem dados externos. Sem storageState.
 *   - Seletores baseados em conteúdo visível real do HTML (sem toHaveTitle).
 *   - Cada teste deve passar em < 10s individualmente.
 */

import { test, expect } from '../support/fixtures';
import { ROUTES } from '../support/constants';

// ---------------------------------------------------------------------------
// Grupo 1 — app está respondendo e renderizando
// ---------------------------------------------------------------------------
test.describe('smoke — app de pé', () => {

  test.beforeEach(async ({ clearAuthState }) => {
    await clearAuthState();
  });

  test('home renderiza conteúdo principal @smoke', async ({ page, goto }) => {
    await goto(ROUTES.home);

    // O título do documento é "Lovable App" (index.html ainda não foi atualizado),
    // então validamos por conteúdo da UI — mais robusto que toHaveTitle.
    // Em mobile, o CTA "Criar conta" some do header, então o mínimo estável
    // aqui é a presença do acesso "Entrar" e do conteúdo principal.
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible();

    // Home.jsx renderiza um h1 com o conteúdo principal
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });

  test('página de login renderiza formulário @smoke', async ({ page, goto }) => {
    await goto(ROUTES.entrar);

    // Entrar.jsx: h1 "Entrar na sua conta" + campos + botão
    await expect(page.getByRole('heading', { name: 'Entrar na sua conta' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Senha')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('página de cadastro de paciente renderiza @smoke', async ({ page, goto }) => {
    await goto(ROUTES.cadastroPaciente);

    await expect(page.getByRole('heading', { name: /criar conta de paciente/i })).toBeVisible();
    await expect(page.locator('form').getByRole('button', { name: 'Criar conta' })).toBeVisible();
  });

  test('especialidades renderiza sem login @smoke', async ({ page, goto }) => {
    await goto(ROUTES.especialidades);

    // Especialidades.jsx: h1 com "Especialidades" ou similar, sem redirect
    await expect(page).not.toHaveURL(/Entrar/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('rota inexistente renderiza 404 sem crash @smoke', async ({ page, goto }) => {
    await goto(ROUTES.notFound);

    // PageNotFound renderiza um heading — não redireciona para /Entrar
    await expect(page).not.toHaveURL(/Entrar/);
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

});

// ---------------------------------------------------------------------------
// Grupo 2 — proteção de rotas (sem login)
// ---------------------------------------------------------------------------
test.describe('smoke — proteção de rotas', () => {

  test.beforeEach(async ({ clearAuthState }) => {
    await clearAuthState();
  });

  test('dashboard do paciente sem auth redireciona para /Entrar @smoke', async ({ page, goto }) => {
    await goto(ROUTES.dashboardPaciente);

    await expect(page).toHaveURL(/Entrar/, { timeout: 10_000 });

    // ProtectedRoute salva rd_login_next para retomar após login
    const loginNext = await page.evaluate(() =>
      window.sessionStorage.getItem('rd_login_next'),
    );
    expect(loginNext).toContain('DashboardPaciente');
  });

  test('consulta/:id sem auth redireciona para /Entrar @smoke', async ({ page, goto }) => {
    await goto(ROUTES.consultaRoom('qualquer-id'));
    await expect(page).toHaveURL(/Entrar/, { timeout: 10_000 });
  });

  test('financeiro profissional sem auth redireciona para /Entrar @smoke', async ({ page, goto }) => {
    await goto(ROUTES.financeiroProf);
    await expect(page).toHaveURL(/Entrar/, { timeout: 10_000 });
  });

});

// ---------------------------------------------------------------------------
// Grupo 3 — redirecionamentos de rota
// ---------------------------------------------------------------------------
test.describe('smoke — redirecionamentos', () => {

  test('alias /Agendamento preserva query string ao redirecionar @smoke', async ({ page, goto }) => {
    await goto('/Agendamento?professional=test-id-123');

    // React Router <Navigate replace> → /AgendamentoPerfil mantendo QS
    await expect(page).toHaveURL(/AgendamentoPerfil/);
    await expect(page).toHaveURL(/professional=test-id-123/);
  });

});
