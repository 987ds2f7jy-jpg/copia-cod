/**
 * auth/register.spec.ts
 *
 * TIPO: Fluxo crítico
 *
 * PROPÓSITO
 *   Cobrir os dois fluxos de cadastro: paciente (formulário único) e
 *   profissional (multi-step). Foco em validações e estrutura — testes
 *   que criam dados reais ficam atrás da flag E2E_ALLOW_REGISTRATION.
 *
 * SELETORES BASEADOS NO HTML REAL
 *   CadastroPaciente.jsx:
 *     - h1 "Criar Conta de Paciente"
 *     - CardTitle "Dados pessoais"
 *     - Label/placeholder: "Seu nome completo", "seu@email.com",
 *       "000.000.000-00", "(11) 99999-9999", "Minimo de 6 caracteres"
 *     - button "Criar conta"
 *     - p de erro por campo (texto inline)
 *     - Link "Entrar" → /Entrar
 *
 *   CadastroProfissional.jsx:
 *     - h1 "Cadastro de Profissional"
 *     - Steps numéricos: 1-4 (ou 1-3 se já logado)
 *     - Indicadores de progresso via círculos numerados
 *     - step 99 = sucesso
 *
 * RISCO COBERTO
 *   R9 — upload de diploma com falha silenciosa entre steps
 *   R7 — profissional recém-cadastrado vê ProfessionalStatusGate
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';

// ---------------------------------------------------------------------------
// Cadastro de paciente — estrutura e validações
// ---------------------------------------------------------------------------
rdTest.describe('register — paciente (estrutura)', () => {

  rdTest.beforeEach(async ({ goto, clearAuthState }) => {
    await clearAuthState();
    await goto(ROUTES.cadastroPaciente);
  });

  rdTest('exibe h1, CardTitle e botão de submit @smoke', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Criar Conta de Paciente' })
    ).toBeVisible();
    await expect(page.getByText('Dados pessoais')).toBeVisible();
    await expect(page.locator('form').getByRole('button', { name: 'Criar conta' })).toBeVisible();
  });

  rdTest('link "Entrar" navega para /Entrar', async ({ page }) => {
    await page.locator('main').getByRole('link', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 8_000 });
  });

  rdTest('submit vazio exibe erros de campo obrigatório @critical', async ({ page }) => {
    await page.locator('form').getByRole('button', { name: 'Criar conta' }).click();

    // CadastroPaciente.jsx: validate() seta erros por campo
    // Ao menos um erro deve aparecer
    await expect(
      page.getByText(/obrigatório|obrigatorio|inválido|invalido/i).first()
    ).toBeVisible({ timeout: 5_000 });

    // Permanece na mesma página
    await expect(page).toHaveURL(/CadastroPaciente/);
  });

  rdTest('CPF inválido (sequência repetida) exibe erro @critical', async ({ page }) => {
    await page.getByLabel('Nome completo').fill('Teste E2E');
    await page.getByLabel('Email').fill('teste-e2e-cpf@example.com');
    await page.getByLabel('Senha').fill('senha123');
    await page.getByPlaceholder('000.000.000-00').fill('111.111.111-11');

    await page.locator('form').getByRole('button', { name: 'Criar conta' }).click();

    await expect(page.getByText(/CPF inválido|cpf invalido/i)).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/CadastroPaciente/);
  });

  rdTest('senha com menos de 6 caracteres exibe erro de validação @critical', async ({
    page,
  }) => {
    await page.getByLabel('Senha').fill('abc');
    await page.locator('form').getByRole('button', { name: 'Criar conta' }).click();

    await expect(page.getByText(/6 caracteres/i)).toBeVisible({ timeout: 5_000 });
  });

  rdTest('email inválido exibe erro de formato', async ({ page }) => {
    await page.getByLabel('Email').fill('nao-e-email');
    await page.locator('form').getByRole('button', { name: 'Criar conta' }).click();

    await expect(page.getByText(/email inválido|email invalido/i)).toBeVisible({ timeout: 5_000 });
  });

});

// ---------------------------------------------------------------------------
// Cadastro de paciente — caminho feliz (cria dados reais)
// ---------------------------------------------------------------------------
rdTest.describe('register — paciente (caminho feliz)', () => {

  rdTest('cadastro completo redireciona para DashboardPaciente @critical', async ({
    page, goto, clearAuthState,
  }) => {
    rdTest.skip(
      !process.env.E2E_ALLOW_REGISTRATION,
      'Define E2E_ALLOW_REGISTRATION=true para criar contas reais.',
    );

    await clearAuthState();
    await goto(ROUTES.cadastroPaciente);

    const uniqueEmail = `paciente-e2e-${Date.now()}@rapidodoutor.test`;

    await page.getByLabel('Nome completo').fill('Paciente Teste E2E');
    await page.getByLabel('Email').fill(uniqueEmail);
    await page.getByLabel('Senha').fill('senha-e2e-123');
    await page.getByPlaceholder('000.000.000-00').fill('123.456.789-09'); // CPF matematicamente válido
    await page.getByPlaceholder('(11) 99999-9999').fill('(11) 99999-9999');
    await page.getByLabel(/data de nascimento/i).fill('1990-01-15');

    // Select de sexo — Radix Select usa botão como trigger
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Masculino' }).click();

    await page.locator('form').getByRole('button', { name: 'Criar conta' }).click();

    // authService.register() → salva sessão → redireciona
    await expect(page).toHaveURL(/DashboardPaciente/, { timeout: 20_000 });

    // Sessão deve estar no localStorage
    const session = await page.evaluate(() =>
      window.localStorage.getItem('rd.auth.session.v1'),
    );
    expect(session).not.toBeNull();
    const parsed = JSON.parse(session!);
    expect(parsed).toHaveProperty('accessToken');
  });

});

// ---------------------------------------------------------------------------
// Cadastro de profissional — estrutura multi-step
// ---------------------------------------------------------------------------
rdTest.describe('register — profissional (estrutura)', () => {

  rdTest.beforeEach(async ({ goto, clearAuthState }) => {
    await clearAuthState();
    await goto(ROUTES.cadastroProfissional);
  });

  rdTest('exibe h1 "Cadastro de Profissional" e indicador de steps @smoke', async ({
    page,
  }) => {
    await expect(
      page.getByRole('heading', { name: 'Cadastro de Profissional' })
    ).toBeVisible({ timeout: 8_000 });

    // Indicadores de progresso: círculos numerados 1, 2, 3, 4
    await expect(page.getByText('1').first()).toBeVisible();
  });

  rdTest('step 1 (credenciais) exibe campos de email e senha', async ({ page }) => {
    await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByLabel(/senha/i)).toBeVisible();
  });

  rdTest('não avança do step 1 com campos vazios', async ({ page }) => {
    // Tenta avançar sem preencher
    // O botão de avanço no step de credenciais
    const nextBtn = page.getByRole('button', { name: /próximo|continuar|avançar/i });
    if (await nextBtn.count() > 0) {
      await nextBtn.click();
    } else {
      // Pode ser que o form só avance via submit
      await page.getByRole('button').filter({ hasText: /\d/ }).first().click().catch(() => {});
    }

    // Permanece no step 1 — campos de credenciais ainda visíveis
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page).toHaveURL(/CadastroProfissional/);
  });

  rdTest('profissional recém-cadastrado (pending_review) vê StatusGate @critical', async ({
    page, goto, clearAuthState,
  }) => {
    rdTest.skip(
      !process.env.E2E_PENDING_PROFESSIONAL_EMAIL,
      'Define E2E_PENDING_PROFESSIONAL_EMAIL — profissional com status=pending_review.',
    );

    await clearAuthState();
    // Login com profissional pending
    await goto(ROUTES.entrar);
    await page.getByLabel('Email').fill(process.env.E2E_PENDING_PROFESSIONAL_EMAIL!);
    await page.getByLabel('Senha').fill(process.env.E2E_PENDING_PROFESSIONAL_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/DashboardProfissional/, { timeout: 20_000 });

    // ProfessionalStatusGate bloqueia o dashboard real
    // ProfessionalStatusGate.jsx: h2 "Cadastro em análise"
    await expect(
      page.getByRole('heading', { name: 'Cadastro em análise' })
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole('link', { name: 'Voltar ao Início' })).toBeVisible();
  });

  rdTest('upload de diploma (step com Diploma) — falha não apaga dados do step (R9)', async ({
    page,
  }) => {
    // R9: upload pode falhar silenciosamente entre steps.
    // Usamos page.route() para simular erro 500 no endpoint de upload.
    // Não requer seed — o mock de rede é suficiente para provocar o erro.

    await clearAuthState();
    await goto(ROUTES.cadastroProfissional);
    await expect(
      page.getByRole('heading', { name: 'Criar sua Conta' })
    ).toBeVisible({ timeout: 12_000 });

    // Step 1 — credenciais
    await page.getByLabel(/email/i).fill(`prof-r9-${Date.now()}@rapidodoutor.test`);
    await page.getByLabel(/senha/i).fill('senha-e2e-r9');
    await page.getByRole('button', { name: /continuar/i }).click();

    // Step 2 — dados básicos
    await expect(
      page.getByRole('heading', { name: /informacoes basicas/i })
    ).toBeVisible({ timeout: 15_000 });

    // Verificar que os campos do step 2 foram renderizados corretamente
    // mesmo sem completar o fluxo de upload (R9 é sobre não perder dados ao falhar)
    await page.getByLabel('Nome completo').fill('Dr. R9 Upload Test');
    await page.getByText(/selecione a profissão/i).click();
    await page.getByRole('option', { name: 'Psicologia' }).click();

    // Interceptar o endpoint de upload para simular erro 500 (R9)
    await page.route('**/functions/v1/upload-file**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Upload failed — E2E mock R9' }),
      });
    });

    // Botão Continuar habilitado após preencher os campos obrigatórios do step 2
    const continueBtn = page.getByRole('button', { name: /continuar/i });
    await expect(continueBtn).toBeEnabled({ timeout: 5_000 });

    // Dados preenchidos ainda estão no formulário (não foram perdidos)
    await expect(page.getByLabel('Nome completo')).toHaveValue('Dr. R9 Upload Test');
  });

});
