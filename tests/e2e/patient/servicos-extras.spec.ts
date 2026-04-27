/**
 * patient/servicos-extras.spec.ts
 *
 * TIPO: Fluxo crítico
 *
 * FLUXOS: Serviços extras do paciente
 *   /SolicitacaoExames  — dois tipos: Check-Up e Exames Específicos
 *   /LaudosMedicos      — aviso inicial → aceitar → formulário multi-step → sucesso
 *   /RenovacaoReceitas  — aviso inicial → aceitar → formulário → upload → sucesso
 *
 * SELETORES REAIS
 *   SolicitacaoExames.jsx:
 *     h1 "Solicitacao de Exames" (sem acento)
 *     h3 "Check-Up", h3 "Exames Especificos" (sem acento)
 *     Dialog "Confirmacao de Check-Up" → Checkbox "Li e confirmo..." → "Confirmar e Enviar"
 *     Dialog "Exames Especificos" → Input exame, Textarea motivo + sintomas → "Solicitar ao Medico"
 *
 *   LaudosMedicos.jsx:
 *     h1 "Laudos Medicos" (sem acento)
 *     button "Confirmo que li os avisos e desejo prosseguir"  (step de aceite)
 *     Após aceite: h1 "Laudos Medicos" + steps de formulário
 *     Sucesso: h2 "Solicitacao enviada!" + button "Ir para a Fila de Atendimento"
 *
 *   RenovacaoReceitas.jsx:
 *     h1 "Renovacao de Receitas" (sem acento)
 *     button "Confirmo que entendi as regras e desejo prosseguir com a renovacao"
 *     Após aceite: Label "Nome do medicamento..." (#medicamento), Label "Dosagem" (#dosagem)
 *     Select de frequência, input de arquivo, button "Enviar Solicitacao de Renovacao"
 *     Sucesso: h2 "Solicitacao Enviada!"
 *
 * LIMITAÇÕES
 *   - Submit real desabilitado por padrão (E2E_ALLOW_SERVICES)
 *   - Upload de arquivo não é testável sem mock de Edge Function
 *   - Fluxo pós-submit (entrada na fila) requer E2E_ALLOW_QUEUE
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';

// ===========================================================================
// SOLICITAÇÃO DE EXAMES
// ===========================================================================

rdTest.describe('solicitacao-exames — sem autenticação', () => {

  rdTest('redireciona para /Entrar sem sessão @critical', async ({
    page, goto, clearAuthState,
  }) => {
    await clearAuthState();
    await goto(ROUTES.solicitacaoExames);
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

});

rdTest.describe('solicitacao-exames — paciente autenticado', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({ page }, testInfo) => {
    void page;
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('página carrega com h1 e dois cards de tipo @critical', async ({ page, goto }) => {
    await goto(ROUTES.solicitacaoExames);
    await expect(page).not.toHaveURL(/\/Entrar/);

    // h1 sem acento (SolicitacaoExames.jsx)
    await expect(
      page.getByRole('heading', { name: 'Solicitacao de Exames' })
    ).toBeVisible({ timeout: 12_000 });

    // Dois cards
    await expect(page.getByRole('heading', { name: 'Check-Up' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Exames Especificos' })).toBeVisible();
  });

  rdTest('clicar em "Check-Up" abre Dialog de confirmação @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.solicitacaoExames);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Solicitacao de Exames' })
    ).toBeVisible({ timeout: 12_000 });

    await page.getByRole('heading', { name: 'Check-Up' }).click();

    // Dialog com DialogTitle "Confirmacao de Check-Up"
    await expect(
      page.getByRole('dialog')
    ).toBeVisible({ timeout: 5_000 });

    await expect(
      page.getByText('Confirmacao de Check-Up')
    ).toBeVisible();

    // Checkbox de confirmação
    await expect(
      page.getByLabel(/li e confirmo que estou assintomatico/i)
    ).toBeVisible();
  });

  rdTest('botão "Confirmar e Enviar" fica desabilitado sem marcar checkbox @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.solicitacaoExames);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Solicitacao de Exames' })
    ).toBeVisible({ timeout: 12_000 });

    await page.getByRole('heading', { name: 'Check-Up' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    await expect(
      page.getByRole('button', { name: 'Confirmar e Enviar' })
    ).toBeDisabled();
  });

  rdTest('marcar checkbox habilita botão "Confirmar e Enviar" @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.solicitacaoExames);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Solicitacao de Exames' })
    ).toBeVisible({ timeout: 12_000 });

    await page.getByRole('heading', { name: 'Check-Up' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    await page.getByLabel(/li e confirmo que estou assintomatico/i).click();
    await expect(
      page.getByRole('button', { name: 'Confirmar e Enviar' })
    ).toBeEnabled();
  });

  rdTest('clicar em "Exames Especificos" abre Dialog correto @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.solicitacaoExames);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Solicitacao de Exames' })
    ).toBeVisible({ timeout: 12_000 });

    await page.getByRole('heading', { name: 'Exames Especificos' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // DialogTitle "Exames Especificos"
    await expect(
      page.getByRole('dialog').getByRole('heading', { name: 'Exames Especificos' })
    ).toBeVisible();

    // Campo de exame
    await expect(
      page.getByPlaceholder(/hemograma|raio-x/i)
    ).toBeVisible();
  });

  rdTest('botão "Solicitar ao Medico" fica desabilitado sem nome do exame @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.solicitacaoExames);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Solicitacao de Exames' })
    ).toBeVisible({ timeout: 12_000 });

    await page.getByRole('heading', { name: 'Exames Especificos' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    await expect(
      page.getByRole('button', { name: 'Solicitar ao Medico' })
    ).toBeDisabled();
  });

  rdTest('preencher nome do exame habilita botão "Solicitar ao Medico" @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.solicitacaoExames);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Solicitacao de Exames' })
    ).toBeVisible({ timeout: 12_000 });

    await page.getByRole('heading', { name: 'Exames Especificos' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    await page.getByPlaceholder(/hemograma|raio-x/i).fill('Hemograma completo');
    await expect(
      page.getByRole('button', { name: 'Solicitar ao Medico' })
    ).toBeEnabled();
  });

  rdTest('"Cancelar" no Dialog de Check-Up fecha sem submeter', async ({ page, goto }) => {
    await goto(ROUTES.solicitacaoExames);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Solicitacao de Exames' })
    ).toBeVisible({ timeout: 12_000 });

    await page.getByRole('heading', { name: 'Check-Up' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Página permanece intacta
    await expect(
      page.getByRole('heading', { name: 'Solicitacao de Exames' })
    ).toBeVisible();
  });

});

// ===========================================================================
// LAUDOS MÉDICOS
// ===========================================================================

rdTest.describe('laudos-medicos — sem autenticação', () => {

  rdTest('redireciona para /Entrar sem sessão @critical', async ({
    page, goto, clearAuthState,
  }) => {
    await clearAuthState();
    await goto(ROUTES.laudosMedicos);
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

});

rdTest.describe('laudos-medicos — paciente autenticado', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({ page }, testInfo) => {
    void page;
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('página carrega com h1 e tela de avisos @critical', async ({ page, goto }) => {
    await goto(ROUTES.laudosMedicos);
    await expect(page).not.toHaveURL(/\/Entrar/);

    // LaudosMedicos.jsx: h1 "Laudos Medicos" (sem acento)
    await expect(
      page.getByRole('heading', { name: 'Laudos Medicos' }).first()
    ).toBeVisible({ timeout: 12_000 });
  });

  rdTest('tela de avisos exibe informações obrigatórias antes do aceite @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.laudosMedicos);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Laudos Medicos' }).first()
    ).toBeVisible({ timeout: 12_000 });

    // Avisos importantes são exibidos antes de aceitar
    await expect(page.getByText(/autonomia medica/i)).toBeVisible();
    await expect(page.getByText(/documentacao obrigatoria/i)).toBeVisible();
  });

  rdTest('botão de aceite existe e é clicável @critical', async ({ page, goto }) => {
    await goto(ROUTES.laudosMedicos);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Laudos Medicos' }).first()
    ).toBeVisible({ timeout: 12_000 });

    await expect(
      page.getByRole('button', { name: /confirmo que li os avisos/i })
    ).toBeVisible();
  });

  rdTest('aceitar avisos exibe o formulário multi-step @critical', async ({ page, goto }) => {
    await goto(ROUTES.laudosMedicos);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Laudos Medicos' }).first()
    ).toBeVisible({ timeout: 12_000 });

    await page.getByRole('button', { name: /confirmo que li os avisos/i }).click();

    // Após aceite, o formulário multi-step aparece
    // LaudosMedicos.jsx mostra steps de formulário (identidade, exames, relatórios)
    // O h1 permanece visível
    await expect(
      page.getByRole('heading', { name: 'Laudos Medicos' }).first()
    ).toBeVisible({ timeout: 8_000 });

    // Deve ter algum indicador de step ou campo de upload
    const hasStepIndicator = await page.locator('[class*="step"]').count() > 0 ||
      await page.getByText(/documento|identidade|upload/i).isVisible().catch(() => false);
    expect(hasStepIndicator).toBe(true);
  });

});

// ===========================================================================
// RENOVAÇÃO DE RECEITAS
// ===========================================================================

rdTest.describe('renovacao-receitas — sem autenticação', () => {

  rdTest('redireciona para /Entrar sem sessão @critical', async ({
    page, goto, clearAuthState,
  }) => {
    await clearAuthState();
    await goto(ROUTES.renovacaoReceitas);
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

});

rdTest.describe('renovacao-receitas — paciente autenticado', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({ page }, testInfo) => {
    void page;
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('página carrega com h1 e avisos antes do aceite @critical', async ({ page, goto }) => {
    await goto(ROUTES.renovacaoReceitas);
    await expect(page).not.toHaveURL(/\/Entrar/);

    // RenovacaoReceitas.jsx: h1 sem acento
    await expect(
      page.getByRole('heading', { name: 'Renovacao de Receitas' })
    ).toBeVisible({ timeout: 12_000 });

    // Avisos obrigatórios
    await expect(page.getByText(/medicamentos nao renovados/i)).toBeVisible();
    await expect(page.getByText(/autonomia medica/i)).toBeVisible();
  });

  rdTest('botão de aceite abre o formulário @critical', async ({ page, goto }) => {
    await goto(ROUTES.renovacaoReceitas);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Renovacao de Receitas' })
    ).toBeVisible({ timeout: 12_000 });

    await page.getByRole('button', {
      name: /confirmo que entendi as regras e desejo prosseguir/i,
    }).click();

    // Formulário aparece com campo de medicamento
    await expect(
      page.locator('#medicamento')
    ).toBeVisible({ timeout: 8_000 });
  });

  rdTest('formulário exibe campos obrigatórios após aceite @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.renovacaoReceitas);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Renovacao de Receitas' })
    ).toBeVisible({ timeout: 12_000 });

    await page.getByRole('button', {
      name: /confirmo que entendi as regras e desejo prosseguir/i,
    }).click();

    await expect(page.locator('#medicamento')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('#dosagem')).toBeVisible();

    // Select de frequência
    await expect(page.getByText('Selecione a frequencia')).toBeVisible();

    // Área de upload de receita
    await expect(
      page.getByText('Clique para enviar JPG, PNG ou PDF')
    ).toBeVisible();
  });

  rdTest('botão submit fica desabilitado sem medicamento e dosagem @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.renovacaoReceitas);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Renovacao de Receitas' })
    ).toBeVisible({ timeout: 12_000 });

    await page.getByRole('button', {
      name: /confirmo que entendi as regras e desejo prosseguir/i,
    }).click();

    await expect(page.locator('#medicamento')).toBeVisible({ timeout: 8_000 });

    // Botão desabilitado sem preencher os campos obrigatórios
    await expect(
      page.getByRole('button', { name: /enviar solicitacao de renovacao/i })
    ).toBeDisabled();
  });

  rdTest('preencher medicamento e dosagem não é suficiente — precisa do arquivo @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.renovacaoReceitas);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', { name: 'Renovacao de Receitas' })
    ).toBeVisible({ timeout: 12_000 });

    await page.getByRole('button', {
      name: /confirmo que entendi as regras e desejo prosseguir/i,
    }).click();

    await expect(page.locator('#medicamento')).toBeVisible({ timeout: 8_000 });

    await page.locator('#medicamento').fill('Losartana');
    await page.locator('#dosagem').fill('50mg');

    // Selecionar frequência
    await page.getByText('Selecione a frequencia').click();
    await page.getByRole('option').first().click();

    // Sem arquivo, o botão ainda deve estar desabilitado
    // RenovacaoReceitas.jsx: formValid = medicamento && dosagem && frequencia && arquivo
    await expect(
      page.getByRole('button', { name: /enviar solicitacao de renovacao/i })
    ).toBeDisabled();
  });

});
