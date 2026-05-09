/**
 * patient/pergunte-especialista.spec.ts
 *
 * TIPO: Fluxo crítico
 *
 * FLUXO: /PergunteEspecialista — fórum de perguntas e respostas
 *
 * SELETORES BASEADOS NO HTML REAL (PergunteEspecialista.jsx)
 *   h1 com "Pergunte" ou similar
 *   Tabs Radix: "Respostas" | "Fazer Pergunta" | "Minhas Perguntas (N)"
 *   Aba Fazer Pergunta:
 *     Select "Selecione a especialidade"
 *     Textarea placeholder "Descreva sua dúvida com detalhes..."
 *     button "Enviar Pergunta" (desabilitado sem especialidade + texto)
 *     Sucesso: div "Pergunta enviada! Acompanhe em \"Minhas Perguntas\"."
 *   Guarda de role:
 *     Profissional: p "Apenas pacientes podem fazer perguntas."
 *   Sem login:
 *     p "Faça login para enviar uma pergunta" + button "Entrar"
 *   Aba Minhas Perguntas:
 *     button Trash2 "Excluir pergunta" (só para pendentes)
 *
 * LIMITAÇÕES
 *   - Submit real (E2E_ALLOW_QUESTIONS) cria pergunta no banco
 *   - Resposta pelo profissional não é testável neste spec (requer 2 usuários)
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';

// ---------------------------------------------------------------------------
// Estrutura pública (sem auth)
// ---------------------------------------------------------------------------
rdTest.describe('pergunte-especialista — público', () => {

  rdTest.beforeEach(async ({ clearAuthState }) => {
    await clearAuthState();
  });

  rdTest('página carrega sem login @smoke', async ({ page, goto }) => {
    await goto(ROUTES.pergunteEspecialista);
    // Não redireciona para /Entrar — é pública para visualização
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });
  });

  rdTest('aba "Respostas" está ativa por padrão', async ({ page, goto }) => {
    await goto(ROUTES.pergunteEspecialista);
    await expect(page).not.toHaveURL(/\/Entrar/);

    // Tabs Radix: aba "Respostas" vem primeiro (defaultValue)
    await expect(
      page.getByRole('tab', { name: 'Respostas' })
    ).toBeVisible({ timeout: 12_000 });
  });

  rdTest('aba "Fazer Pergunta" existe e é clicável', async ({ page, goto }) => {
    await goto(ROUTES.pergunteEspecialista);
    await expect(page).not.toHaveURL(/\/Entrar/);

    await page.getByRole('tab', { name: 'Fazer Pergunta' }).click();
    await expect(
      page.getByRole('tab', { name: 'Fazer Pergunta' })
    ).toHaveAttribute('aria-selected', 'true');
  });

  rdTest('sem login na aba "Fazer Pergunta" mostra CTA de login @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.pergunteEspecialista);
    await expect(page).not.toHaveURL(/\/Entrar/);

    await page.getByRole('tab', { name: 'Fazer Pergunta' }).click();

    // PergunteEspecialista.jsx: "Faça login para enviar uma pergunta"
    await expect(
      page.getByText(/faça login para enviar uma pergunta/i)
    ).toBeVisible({ timeout: 8_000 });

    await expect(
      page.getByLabel('Fazer Pergunta').getByRole('link', { name: 'Entrar' })
    ).toBeVisible();
  });

});

// ---------------------------------------------------------------------------
// Paciente autenticado — envio de pergunta
// ---------------------------------------------------------------------------
rdTest.describe('pergunte-especialista — paciente autenticado', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({ page }, testInfo) => {
    void page;
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('aba "Fazer Pergunta" exibe formulário para paciente autenticado @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.pergunteEspecialista);
    await expect(page).not.toHaveURL(/\/Entrar/);

    await page.getByRole('tab', { name: 'Fazer Pergunta' }).click();

    // Formulário deve aparecer (não o CTA de login)
    await expect(
      page.getByText(/faça login/i)
    ).not.toBeVisible({ timeout: 5_000 });

    // Select de especialidade
    await expect(
      page.getByText('Selecione a especialidade')
    ).toBeVisible({ timeout: 8_000 });

    // Textarea para a pergunta
    await expect(
      page.getByPlaceholder(/descreva sua dúvida/i)
    ).toBeVisible();
  });

  rdTest('botão "Enviar Pergunta" fica desabilitado sem especialidade e texto @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.pergunteEspecialista);
    await expect(page).not.toHaveURL(/\/Entrar/);

    await page.getByRole('tab', { name: 'Fazer Pergunta' }).click();
    await expect(
      page.getByText('Selecione a especialidade')
    ).toBeVisible({ timeout: 8_000 });

    await expect(
      page.getByRole('button', { name: 'Enviar Pergunta' })
    ).toBeDisabled();
  });

  rdTest('preencher especialidade + texto habilita o botão @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.pergunteEspecialista);
    await expect(page).not.toHaveURL(/\/Entrar/);

    await page.getByRole('tab', { name: 'Fazer Pergunta' }).click();
    await expect(
      page.getByText('Selecione a especialidade')
    ).toBeVisible({ timeout: 8_000 });

    // Selecionar especialidade
    await page.getByText('Selecione a especialidade').click();
    await page.getByRole('option').first().click();

    // Preencher pergunta
    await page.getByPlaceholder(/descreva sua dúvida/i).fill(
      'Tenho pressão alta. Posso tomar losartana com metformina?',
    );

    await expect(
      page.getByRole('button', { name: 'Enviar Pergunta' })
    ).toBeEnabled();
  });

  rdTest('envio de pergunta exibe confirmação de sucesso @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(
      !process.env.E2E_ALLOW_QUESTIONS,
      'Define E2E_ALLOW_QUESTIONS=true para criar perguntas reais.',
    );

    await goto(ROUTES.pergunteEspecialista);
    await expect(page).not.toHaveURL(/\/Entrar/);

    await page.getByRole('tab', { name: 'Fazer Pergunta' }).click();
    await expect(
      page.getByText('Selecione a especialidade')
    ).toBeVisible({ timeout: 8_000 });

    await page.getByText('Selecione a especialidade').click();
    await page.getByRole('option').first().click();
    await page.getByPlaceholder(/descreva sua dúvida/i).fill(
      'Pergunta de teste E2E — posso ignorar.',
    );

    await page.getByRole('button', { name: 'Enviar Pergunta' }).click();

    // Feedback de sucesso: "Pergunta enviada! Acompanhe em \"Minhas Perguntas\"."
    await expect(
      page.getByText(/pergunta enviada/i)
    ).toBeVisible({ timeout: 12_000 });
  });

  rdTest('aba "Minhas Perguntas" existe e é acessível pelo paciente', async ({
    page, goto,
  }) => {
    await goto(ROUTES.pergunteEspecialista);
    await expect(page).not.toHaveURL(/\/Entrar/);

    // Aba pode mostrar contador: "Minhas Perguntas (N)"
    await page.getByRole('tab', { name: /minhas perguntas/i }).click();
    await expect(
      page.getByRole('tab', { name: /minhas perguntas/i })
    ).toHaveAttribute('aria-selected', 'true');
  });

});

// ---------------------------------------------------------------------------
// Profissional — bloqueio na aba de envio
// ---------------------------------------------------------------------------
rdTest.describe('pergunte-especialista — profissional não pode perguntar', () => {

  rdTest.use({ storageState: AUTH_STATE.professional });

  rdTest.beforeEach(async ({ page }, testInfo) => {
    void page;
    skipIfNoAuth(testInfo, 'professional');
  });

  rdTest('profissional vê mensagem "Apenas pacientes podem fazer perguntas" @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.pergunteEspecialista);
    await expect(page).not.toHaveURL(/\/Entrar/);

    await page.getByRole('tab', { name: 'Fazer Pergunta' }).click();

    // PergunteEspecialista.jsx: "Apenas pacientes podem fazer perguntas."
    await expect(
      page.getByText(/apenas pacientes podem fazer perguntas/i)
    ).toBeVisible({ timeout: 8_000 });

    // O botão de envio não deve aparecer para profissional
    await expect(
      page.getByRole('button', { name: 'Enviar Pergunta' })
    ).not.toBeVisible();
  });

});
