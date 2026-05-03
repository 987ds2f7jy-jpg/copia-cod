/**
 * patient/laudos-steps.spec.ts
 *
 * ROTA: /LaudosMedicos — 4 steps após aceite dos avisos
 *
 * STEPS REAIS (LaudosMedicos.jsx)
 *   step=0 h2 "Identificacao"        — nome*, nascimento*, CPF*, telefone*, email*
 *   step=1 h2 "Informacoes de Saude" — diagnostico* (obrigatório), histórico, doenças, alergias, medicamentos
 *   step=2 h2 "Especificacao do Laudo" — tipo* (Select), finalidade* (Textarea)
 *   step=3 h2 "Documentos de Apoio"  — identidade* (obrigatório), exames (opcional), relatórios (opcional)
 *   Botão avançar: "Proxima" (sem acento) — disabled={!canAdvance()}
 *   Botão voltar:  "Anterior"
 *   Sucesso: h2 "Solicitacao enviada!" + button "Ir para a Fila de Atendimento"
 *
 * canAdvance() por step:
 *   0 → nome && nascimento && cpf && telefone && email
 *   1 → diagnostico.trim()
 *   2 → tipoLaudo && finalidade.trim()
 *   3 → docIdentidade (arquivo)
 *
 * LIMITAÇÕES
 *   - Upload de identidade (step 3) requer E2E_ALLOW_UPLOAD
 *   - Submit real (PaymentStep → finalizePaidLaudo) requer E2E_ALLOW_SERVICES
 *   - Tela de sucesso só testável com E2E_ALLOW_SERVICES + E2E_ALLOW_UPLOAD
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';

// Helper: navega até o formulário (pós-aceite dos avisos)
async function aceitarEChegar(page: import('@playwright/test').Page) {
  await expect(
    page.getByRole('heading', { name: 'Laudos Medicos' }).first()
  ).toBeVisible({ timeout: 12_000 });
  await page.getByRole('button', { name: /confirmo que li os avisos/i }).click();
  await expect(
    page.getByRole('heading', { name: 'Identificacao' })
  ).toBeVisible({ timeout: 8_000 });
}

// ===========================================================================
// Step 0 — Identificação
// ===========================================================================
rdTest.describe('laudos-steps — step 0: Identificação', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('step 0 renderiza h2 e os 5 campos obrigatórios @critical', async ({ page, goto }) => {
    await goto(ROUTES.laudosMedicos);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await aceitarEChegar(page);

    await expect(page.getByRole('heading', { name: 'Identificacao' })).toBeVisible();
    await expect(page.getByText('Nome completo *')).toBeVisible();
    await expect(page.getByText('Data de nascimento *')).toBeVisible();
    await expect(page.getByText('CPF *')).toBeVisible();
    await expect(page.getByText('Telefone *')).toBeVisible();
    await expect(page.getByText('E-mail *')).toBeVisible();
  });

  rdTest('"Proxima" desabilitado com formulário vazio @critical', async ({ page, goto }) => {
    await goto(ROUTES.laudosMedicos);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await aceitarEChegar(page);

    await expect(
      page.getByRole('button', { name: 'Proxima' })
    ).toBeDisabled();
  });

  rdTest('"Proxima" desabilitado com apenas nome preenchido @critical', async ({ page, goto }) => {
    await goto(ROUTES.laudosMedicos);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await aceitarEChegar(page);

    await page.getByLabel('Nome completo *').fill('Paciente E2E');
    await expect(page.getByRole('button', { name: 'Proxima' })).toBeDisabled();
  });

  rdTest('"Proxima" habilita com todos os 5 campos preenchidos @critical', async ({ page, goto }) => {
    await goto(ROUTES.laudosMedicos);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await aceitarEChegar(page);

    await page.getByLabel('Nome completo *').fill('Paciente E2E Teste');
    await page.getByPlaceholder('DD/MM/AAAA').fill('01/01/1990');
    await page.getByLabel('CPF *').fill('123.456.789-09');
    await page.getByLabel('Telefone *').fill('(11) 99999-0000');
    await page.getByLabel('E-mail *').fill('e2e@rapidodoutor.test');

    await expect(
      page.getByRole('button', { name: 'Proxima' })
    ).toBeEnabled({ timeout: 3_000 });
  });

  rdTest('indicador de progress mostra os 4 steps com labels @critical', async ({ page, goto }) => {
    await goto(ROUTES.laudosMedicos);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await aceitarEChegar(page);

    // STEPS = ['Identificacao', 'Saude', (implícito Especificacao), 'Documentos']
    await expect(page.getByText('Identificacao').first()).toBeVisible();
    await expect(page.getByText('Saude')).toBeVisible();
    await expect(page.getByText('Documentos')).toBeVisible();
  });

});

// ===========================================================================
// Step 1 — Informações de Saúde
// ===========================================================================
rdTest.describe('laudos-steps — step 1: Informações de Saúde', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('avançar para step 1 exibe h2 "Informacoes de Saude" @critical', async ({ page, goto }) => {
    await goto(ROUTES.laudosMedicos);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await aceitarEChegar(page);

    // Preencher step 0 completo
    await page.getByLabel('Nome completo *').fill('Paciente E2E');
    await page.getByPlaceholder('DD/MM/AAAA').fill('01/01/1990');
    await page.getByLabel('CPF *').fill('123.456.789-09');
    await page.getByLabel('Telefone *').fill('(11) 99999-0000');
    await page.getByLabel('E-mail *').fill('e2e@rapidodoutor.test');
    await page.getByRole('button', { name: 'Proxima' }).click();

    await expect(
      page.getByRole('heading', { name: 'Informacoes de Saude' })
    ).toBeVisible({ timeout: 8_000 });
  });

  rdTest('"Proxima" desabilitado sem diagnóstico no step 1 @critical', async ({ page, goto }) => {
    await goto(ROUTES.laudosMedicos);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await aceitarEChegar(page);

    // Avançar step 0
    await page.getByLabel('Nome completo *').fill('Paciente E2E');
    await page.getByPlaceholder('DD/MM/AAAA').fill('01/01/1990');
    await page.getByLabel('CPF *').fill('123.456.789-09');
    await page.getByLabel('Telefone *').fill('(11) 99999-0000');
    await page.getByLabel('E-mail *').fill('e2e@rapidodoutor.test');
    await page.getByRole('button', { name: 'Proxima' }).click();
    await expect(page.getByRole('heading', { name: 'Informacoes de Saude' })).toBeVisible();

    // Sem diagnóstico → Proxima disabled
    await expect(page.getByRole('button', { name: 'Proxima' })).toBeDisabled();
  });

  rdTest('"Proxima" habilita com diagnóstico preenchido @critical', async ({ page, goto }) => {
    await goto(ROUTES.laudosMedicos);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await aceitarEChegar(page);

    await page.getByLabel('Nome completo *').fill('Paciente E2E');
    await page.getByPlaceholder('DD/MM/AAAA').fill('01/01/1990');
    await page.getByLabel('CPF *').fill('123.456.789-09');
    await page.getByLabel('Telefone *').fill('(11) 99999-0000');
    await page.getByLabel('E-mail *').fill('e2e@rapidodoutor.test');
    await page.getByRole('button', { name: 'Proxima' }).click();
    await expect(page.getByRole('heading', { name: 'Informacoes de Saude' })).toBeVisible();

    await page.getByLabel('Diagnostico atual ou motivo do laudo *').fill('Ansiedade — diagnóstico E2E');
    await expect(page.getByRole('button', { name: 'Proxima' })).toBeEnabled();
  });

  rdTest('"Anterior" no step 1 volta para step 0 @critical', async ({ page, goto }) => {
    await goto(ROUTES.laudosMedicos);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await aceitarEChegar(page);

    await page.getByLabel('Nome completo *').fill('Paciente E2E');
    await page.getByPlaceholder('DD/MM/AAAA').fill('01/01/1990');
    await page.getByLabel('CPF *').fill('123.456.789-09');
    await page.getByLabel('Telefone *').fill('(11) 99999-0000');
    await page.getByLabel('E-mail *').fill('e2e@rapidodoutor.test');
    await page.getByRole('button', { name: 'Proxima' }).click();
    await expect(page.getByRole('heading', { name: 'Informacoes de Saude' })).toBeVisible();

    await page.getByRole('button', { name: 'Anterior' }).click();
    await expect(page.getByRole('heading', { name: 'Identificacao' })).toBeVisible();
  });

  rdTest('campos opcionais do step 1 estão presentes', async ({ page, goto }) => {
    await goto(ROUTES.laudosMedicos);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await aceitarEChegar(page);

    await page.getByLabel('Nome completo *').fill('Paciente E2E');
    await page.getByPlaceholder('DD/MM/AAAA').fill('01/01/1990');
    await page.getByLabel('CPF *').fill('123.456.789-09');
    await page.getByLabel('Telefone *').fill('(11) 99999-0000');
    await page.getByLabel('E-mail *').fill('e2e@rapidodoutor.test');
    await page.getByRole('button', { name: 'Proxima' }).click();
    await expect(page.getByRole('heading', { name: 'Informacoes de Saude' })).toBeVisible();

    await expect(page.getByText('Historico clinico relevante')).toBeVisible();
    await expect(page.getByText('Doencas cronicas')).toBeVisible();
    await expect(page.getByText('Alergias')).toBeVisible();
    await expect(page.getByText('Medicamentos em uso')).toBeVisible();
  });

});

// ===========================================================================
// Step 2 — Especificação do Laudo
// ===========================================================================
rdTest.describe('laudos-steps — step 2: Especificação do Laudo', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  // Helper para chegar ao step 2
  async function chegarStep2(page: import('@playwright/test').Page) {
    await aceitarEChegar(page);
    await page.getByLabel('Nome completo *').fill('Paciente E2E');
    await page.getByPlaceholder('DD/MM/AAAA').fill('01/01/1990');
    await page.getByLabel('CPF *').fill('123.456.789-09');
    await page.getByLabel('Telefone *').fill('(11) 99999-0000');
    await page.getByLabel('E-mail *').fill('e2e@rapidodoutor.test');
    await page.getByRole('button', { name: 'Proxima' }).click();
    await expect(page.getByRole('heading', { name: 'Informacoes de Saude' })).toBeVisible();
    await page.getByLabel('Diagnostico atual ou motivo do laudo *').fill('Diagnóstico E2E');
    await page.getByRole('button', { name: 'Proxima' }).click();
    await expect(page.getByRole('heading', { name: 'Especificacao do Laudo' })).toBeVisible({ timeout: 8_000 });
  }

  rdTest('step 2 exibe Select de tipo e Textarea de finalidade @critical', async ({ page, goto }) => {
    await goto(ROUTES.laudosMedicos);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await chegarStep2(page);

    await expect(page.getByText('Tipo de laudo solicitado *')).toBeVisible();
    await expect(page.getByPlaceholder('Descreva a finalidade do laudo...')).toBeVisible();
  });

  rdTest('"Proxima" desabilitado sem tipo e finalidade @critical', async ({ page, goto }) => {
    await goto(ROUTES.laudosMedicos);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await chegarStep2(page);

    await expect(page.getByRole('button', { name: 'Proxima' })).toBeDisabled();
  });

  rdTest('"Proxima" habilita com tipo + finalidade preenchidos @critical', async ({ page, goto }) => {
    await goto(ROUTES.laudosMedicos);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await chegarStep2(page);

    // Selecionar tipo de laudo
    await page.getByText('Selecione o tipo').click();
    await page.getByRole('option').first().click();

    await page.getByPlaceholder('Descreva a finalidade do laudo...').fill('Finalidade E2E teste');

    await expect(page.getByRole('button', { name: 'Proxima' })).toBeEnabled({ timeout: 3_000 });
  });

});

// ===========================================================================
// Step 3 — Documentos de Apoio
// ===========================================================================
rdTest.describe('laudos-steps — step 3: Documentos de Apoio', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('step 3 exibe label de documento de identidade obrigatório @critical', async ({ page, goto }) => {
    rdTest.skip(
      !process.env.E2E_REACH_STEP3,
      'Preencher steps 0-2 completos é caro. Define E2E_REACH_STEP3=true para executar.',
    );

    await goto(ROUTES.laudosMedicos);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await aceitarEChegar(page);

    // Steps 0→1→2 completos
    await page.getByLabel('Nome completo *').fill('Paciente E2E');
    await page.getByPlaceholder('DD/MM/AAAA').fill('01/01/1990');
    await page.getByLabel('CPF *').fill('123.456.789-09');
    await page.getByLabel('Telefone *').fill('(11) 99999-0000');
    await page.getByLabel('E-mail *').fill('e2e@rapidodoutor.test');
    await page.getByRole('button', { name: 'Proxima' }).click();
    await expect(page.getByRole('heading', { name: 'Informacoes de Saude' })).toBeVisible();
    await page.getByLabel('Diagnostico atual ou motivo do laudo *').fill('Diagnóstico E2E step3');
    await page.getByRole('button', { name: 'Proxima' }).click();
    await expect(page.getByRole('heading', { name: 'Especificacao do Laudo' })).toBeVisible();
    await page.getByText('Selecione o tipo').click();
    await page.getByRole('option').first().click();
    await page.getByPlaceholder('Descreva a finalidade do laudo...').fill('Finalidade E2E');
    await page.getByRole('button', { name: 'Proxima' }).click();

    await expect(
      page.getByRole('heading', { name: 'Documentos de Apoio' })
    ).toBeVisible({ timeout: 8_000 });

    await expect(
      page.getByText('Documento de identidade * (PDF, JPG ou PNG - max. 10MB)')
    ).toBeVisible();
    await expect(page.getByText('Exames recentes (opcional - ate 5 arquivos)')).toBeVisible();
    await expect(page.getByText('Relatorios medicos (opcional - ate 5 arquivos)')).toBeVisible();
  });

});

// ===========================================================================
// Tela de sucesso
// ===========================================================================
rdTest.describe('laudos-steps — tela de sucesso', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('tela de sucesso: h2 "Solicitacao enviada!" e botão "Ir para a Fila de Atendimento" @critical', async ({ page, goto }) => {
    rdTest.skip(
      !process.env.E2E_ALLOW_SERVICES,
      'Define E2E_ALLOW_SERVICES=true. Requer também E2E_ALLOW_UPLOAD e fluxo completo.',
    );
    rdTest.skip(
      !process.env.E2E_ALLOW_UPLOAD,
      'Define E2E_ALLOW_UPLOAD=true para upload de identidade real.',
    );

    // Nota: o sucesso requer passar pelo PaymentStep do step 3 também.
    // Implementar seed ou mock do PaymentStep para habilitar este teste.
    rdTest.fixme();
  });

  rdTest('"Ir para a Fila de Atendimento" navega para /ConsultaAgora @critical', async ({ page, goto }) => {
    rdTest.skip(
      !process.env.E2E_ALLOW_SERVICES,
      'Define E2E_ALLOW_SERVICES=true.',
    );
    rdTest.fixme();
  });

});
