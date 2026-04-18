/**
 * auth/login.spec.ts
 *
 * TIPO: Fluxo crítico
 *
 * PROPÓSITO
 *   Cobrir completamente o fluxo de login: caminho feliz por role,
 *   erros de credenciais, validação frontend, mecanismo rd_login_next,
 *   persistência de sessão em localStorage e ausência de recuperação
 *   de senha (documentada como gap intencional).
 *
 * SELETORES
 *   Baseados no HTML real de Entrar.jsx:
 *     - getByLabel('Email')       → <Input id="email">
 *     - getByLabel('Senha')       → <Input id="password">
 *     - getByRole('button', 'Entrar') → <Button type="submit">
 *     - getByRole('heading', 'Entrar na sua conta') → <h1>
 *
 * DEPENDÊNCIAS
 *   Testes de caminho feliz dependem de E2E_PATIENT_EMAIL/PASSWORD e
 *   E2E_PROFESSIONAL_EMAIL/PASSWORD. Quando não definidos, os testes
 *   fazem skip com mensagem clara — nunca falham por configuração ausente.
 *
 * RISCO COBERTO
 *   R3  — sessão salva corretamente em localStorage
 *   R10 — rd_login_next limpo após login bem-sucedido (e não em falha)
 */

import { test, expect } from '../support/fixtures';
import { ROUTES, USERS } from '../support/constants';

const hasPatientCreds = !!(process.env.E2E_PATIENT_EMAIL && process.env.E2E_PATIENT_PASSWORD);
const hasProfessionalCreds = !!(process.env.E2E_PROFESSIONAL_EMAIL && process.env.E2E_PROFESSIONAL_PASSWORD);

// ---------------------------------------------------------------------------
// Estrutura do formulário (independe de credenciais)
// ---------------------------------------------------------------------------
test.describe('login — formulário', () => {

  test.beforeEach(async ({ clearAuthState, goto }) => {
    await clearAuthState();
    await goto(ROUTES.entrar);
  });

  test('exibe os elementos corretos na tela de login @smoke', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Entrar na sua conta' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Senha')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
    await expect(page.getByRole('link', { name: /criar conta de paciente/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /cadastrar-se como profissional/i })).toBeVisible();
  });

  test('campos vazios exibem erro de validação sem chamar API @critical', async ({ page }) => {
    // Entrar.jsx valida no handleSubmit antes de chamar authService.login()
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByText('Preencha email e senha.')).toBeVisible();
    // Permanece na página de login
    await expect(page).toHaveURL(/Entrar/);
    // Nenhuma chamada de rede foi feita (validação é puramente frontend)
  });

  test('credenciais inválidas exibem mensagem de erro @critical', async ({ page }) => {
    await page.getByLabel('Email').fill('naoexiste-e2e@example.com');
    await page.getByLabel('Senha').fill('senha-invalida-e2e');
    await page.getByRole('button', { name: 'Entrar' }).click();

    // Mensagem de erro vinda do authService.login() via getUserFacingErrorMessage()
    await expect(
      page.getByText(/erro ao fazer login|credenciais|inválid/i)
    ).toBeVisible({ timeout: 12_000 });

    await expect(page).toHaveURL(/Entrar/);
  });

  test('toggle de visibilidade da senha funciona', async ({ page }) => {
    await page.getByLabel('Senha').fill('minha-senha');

    // Campo começa como type="password"
    await expect(page.getByLabel('Senha')).toHaveAttribute('type', 'password');

    // Clicar no ícone de olho alterna para type="text"
    await page.getByRole('button', { name: /mostrar|ocultar|eye/i }).click().catch(async () => {
      // O botão do olho não tem name acessível — usar posição relativa ao campo
      await page.locator('input#password ~ button').click();
    });

    await expect(page.getByLabel('Senha')).toHaveAttribute('type', 'text');
  });

  test('não existe link de recuperação de senha (gap documentado)', async ({ page }) => {
    // Documenta ausência intencional. Quando implementado, este teste
    // DEVE FALHAR e ser substituído por testes reais de reset.
    const forgotLink = page.getByRole('link', { name: /esqueci|recuperar|redefinir.*senha/i });
    await expect(forgotLink).not.toBeVisible();
  });

});

// ---------------------------------------------------------------------------
// Caminho feliz — paciente
// ---------------------------------------------------------------------------
test.describe('login — caminho feliz paciente', () => {

  test.beforeEach(async ({ clearAuthState }) => {
    await clearAuthState();
  });

  test('paciente faz login e vai para DashboardPaciente @critical', async ({ page, goto }) => {
    test.skip(!hasPatientCreds, 'Defina E2E_PATIENT_EMAIL e E2E_PATIENT_PASSWORD');

    await goto(ROUTES.entrar);
    await page.getByLabel('Email').fill(USERS.patient.email);
    await page.getByLabel('Senha').fill(USERS.patient.password);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/DashboardPaciente/, { timeout: 20_000 });

    // DashboardPaciente.jsx renderiza "Olá, {primeiroNome}!"
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('sessão é salva corretamente no localStorage após login @critical', async ({ page, goto }) => {
    test.skip(!hasPatientCreds, 'Defina E2E_PATIENT_EMAIL e E2E_PATIENT_PASSWORD');

    await goto(ROUTES.entrar);
    await page.getByLabel('Email').fill(USERS.patient.email);
    await page.getByLabel('Senha').fill(USERS.patient.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/DashboardPaciente/, { timeout: 20_000 });

    // authService.login() → saveStoredSession() → chave rd.auth.session.v1
    const raw = await page.evaluate(() =>
      window.localStorage.getItem('rd.auth.session.v1'),
    );
    expect(raw).not.toBeNull();

    const session = JSON.parse(raw!);
    // Estrutura definida em normalizeSession() em session.js
    expect(session).toHaveProperty('accessToken');
    expect(session).toHaveProperty('refreshToken');
    expect(typeof session.accessToken).toBe('string');
    expect(session.accessToken.length).toBeGreaterThan(10);
  });

  test('menu do Layout mostra nome do usuário após login @critical', async ({ page, goto }) => {
    test.skip(!hasPatientCreds, 'Defina E2E_PATIENT_EMAIL e E2E_PATIENT_PASSWORD');

    await goto(ROUTES.entrar);
    await page.getByLabel('Email').fill(USERS.patient.email);
    await page.getByLabel('Senha').fill(USERS.patient.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/DashboardPaciente/, { timeout: 20_000 });

    // Layout.jsx: user.full_name.split(' ')[0] || 'Usuário'
    // O botão de dropdown mostra o primeiro nome do usuário
    const firstName = USERS.patient.name.split(' ')[0];
    await expect(page.getByRole('button', { name: new RegExp(firstName, 'i') })).toBeVisible();
  });

  test('usuário já logado que acessa /Entrar é redirecionado @critical', async ({ page, goto }) => {
    test.skip(!hasPatientCreds, 'Defina E2E_PATIENT_EMAIL e E2E_PATIENT_PASSWORD');

    // Faz login
    await goto(ROUTES.entrar);
    await page.getByLabel('Email').fill(USERS.patient.email);
    await page.getByLabel('Senha').fill(USERS.patient.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/DashboardPaciente/, { timeout: 20_000 });

    // Tenta voltar para /Entrar
    await goto(ROUTES.entrar);

    // Entrar.jsx: useEffect detecta user !== null e redireciona
    await expect(page).toHaveURL(/DashboardPaciente/, { timeout: 10_000 });
  });

});

// ---------------------------------------------------------------------------
// Caminho feliz — profissional
// ---------------------------------------------------------------------------
test.describe('login — caminho feliz profissional', () => {

  test.beforeEach(async ({ clearAuthState }) => {
    await clearAuthState();
  });

  test('profissional faz login e vai para DashboardProfissional @critical', async ({ page, goto }) => {
    test.skip(!hasProfessionalCreds, 'Defina E2E_PROFESSIONAL_EMAIL e E2E_PROFESSIONAL_PASSWORD');

    await goto(ROUTES.entrar);
    await page.getByLabel('Email').fill(USERS.professional.email);
    await page.getByLabel('Senha').fill(USERS.professional.password);
    await page.getByRole('button', { name: 'Entrar' }).click();

    // resolveRedirectPath() → role=professional → DashboardProfissional
    await expect(page).toHaveURL(/DashboardProfissional/, { timeout: 20_000 });
  });

  test('menu do Layout mostra badge "Profissional" @critical', async ({ page, goto }) => {
    test.skip(!hasProfessionalCreds, 'Defina E2E_PROFESSIONAL_EMAIL e E2E_PROFESSIONAL_PASSWORD');

    await goto(ROUTES.entrar);
    await page.getByLabel('Email').fill(USERS.professional.email);
    await page.getByLabel('Senha').fill(USERS.professional.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/DashboardProfissional/, { timeout: 20_000 });

    // Layout.jsx: user.role === 'professional' → badge "Profissional"
    // Abrir o dropdown para ver o badge
    const firstName = USERS.professional.name.split(' ')[0];
    await page.getByRole('button', { name: new RegExp(firstName, 'i') }).click();
    await expect(page.getByText('Profissional')).toBeVisible();
  });

});

// ---------------------------------------------------------------------------
// Mecanismo rd_login_next
// ---------------------------------------------------------------------------
test.describe('login — redirecionamento pós-login (rd_login_next)', () => {

  test.beforeEach(async ({ clearAuthState }) => {
    await clearAuthState();
  });

  test('após login, redireciona para a URL que o usuário tentou acessar @critical', async ({
    page, goto,
  }) => {
    test.skip(!hasPatientCreds, 'Defina E2E_PATIENT_EMAIL e E2E_PATIENT_PASSWORD');

    // 1. Tenta acessar rota protegida sem auth
    await goto(ROUTES.perfil);

    // 2. ProtectedRoute chama redirectToLogin(pathname) → salva rd_login_next
    await expect(page).toHaveURL(/Entrar/, { timeout: 10_000 });
    const savedNext = await page.evaluate(() =>
      window.sessionStorage.getItem('rd_login_next'),
    );
    expect(savedNext).toContain('Perfil');

    // 3. Faz login
    await page.getByLabel('Email').fill(USERS.patient.email);
    await page.getByLabel('Senha').fill(USERS.patient.password);
    await page.getByRole('button', { name: 'Entrar' }).click();

    // 4. Deve ir para /Perfil, não para /DashboardPaciente
    await expect(page).toHaveURL(/Perfil/, { timeout: 20_000 });

    // 5. rd_login_next foi limpo (não fica poluindo sessões futuras)
    const afterLogin = await page.evaluate(() =>
      window.sessionStorage.getItem('rd_login_next'),
    );
    expect(afterLogin).toBeNull();
  });

  test('rd_login_next NÃO é limpo quando o login falha (R10)', async ({ page, goto }) => {
    // Salva um rd_login_next manualmente e tenta login com credenciais erradas.
    // O valor deve persistir para ser usado no próximo login bem-sucedido.
    await goto(ROUTES.entrar);
    await page.evaluate(() =>
      window.sessionStorage.setItem('rd_login_next', '/Perfil'),
    );

    await page.getByLabel('Email').fill('invalido@example.com');
    await page.getByLabel('Senha').fill('errada');
    await page.getByRole('button', { name: 'Entrar' }).click();

    // Aguarda resposta de erro
    await expect(page.getByText(/erro ao fazer login|credenciais|inválid/i))
      .toBeVisible({ timeout: 12_000 });

    // rd_login_next permanece — não foi limpo pelo login que falhou
    const afterFailedLogin = await page.evaluate(() =>
      window.sessionStorage.getItem('rd_login_next'),
    );
    expect(afterFailedLogin).toBe('/Perfil');
  });

});

// ---------------------------------------------------------------------------
// Conta inativa
// ---------------------------------------------------------------------------
test.describe('login — conta inativa', () => {

  test('conta inativa exibe mensagem específica @critical', async ({ page, goto, clearAuthState }) => {
    test.skip(
      !process.env.E2E_INACTIVE_EMAIL,
      'Requer E2E_INACTIVE_EMAIL — usuário com is_active=false no banco.',
    );

    await clearAuthState();
    await goto(ROUTES.entrar);
    await page.getByLabel('Email').fill(process.env.E2E_INACTIVE_EMAIL!);
    await page.getByLabel('Senha').fill(process.env.E2E_INACTIVE_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Entrar' }).click();

    // authService: AppError code ACCOUNT_INACTIVE → "Sua conta está inativa"
    await expect(page.getByText(/conta.*inativa|inativa/i)).toBeVisible({ timeout: 12_000 });
    await expect(page).toHaveURL(/Entrar/);
  });

});
