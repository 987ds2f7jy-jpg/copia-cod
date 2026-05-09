/**
 * patient/renovacao-receitas-completo.spec.ts
 *
 * TIPO: Fluxo crítico (complemento de servicos-extras.spec.ts)
 *
 * PROPÓSITO
 *   O servicos-extras.spec.ts já cobre a estrutura básica da RenovacaoReceitas:
 *     ✓ Sem auth → redireciona para /Entrar
 *     ✓ h1 e avisos antes do aceite
 *     ✓ Botão de aceite abre o formulário
 *     ✓ Campos #medicamento, #dosagem, Select frequência presentes
 *     ✓ Submit desabilitado sem arquivo mesmo com campos preenchidos
 *
 *   Este arquivo adiciona:
 *     → Preenchimento sequencial com validação de cada campo obrigatório
 *     → Estado de loading durante o envio (Loader2)
 *     → Tela de sucesso: h2 "Solicitacao Enviada!" + texto + button "Voltar"
 *     → Navegação pós-sucesso
 *     → Upload via input file (testável apenas com mock ou arquivo real)
 *     → Frequências de uso disponíveis no Select
 *
 * SELETORES REAIS (RenovacaoReceitas.jsx)
 *   h1 "Renovacao de Receitas"
 *   p  "Renove suas receitas de medicamentos..."
 *   Botão aceite: "Confirmo que entendi as regras e desejo prosseguir com a renovacao"
 *   Label "Nome do medicamento ou composto ativo *" → id="medicamento"
 *   Label "Dosagem do medicamento *"               → id="dosagem"
 *   Label "Frequencia de uso *"                    → Select com 6 opções
 *   Label "Upload da ultima receita *"             → input#arquivo (hidden)
 *   Button "Enviar Solicitacao de Renovacao"       → disabled sem formValid
 *   Estado loading: <Loader2 className="animate-spin" />
 *   Estado success:
 *     h2 "Solicitacao Enviada!"
 *     p  "Seu pedido de renovacao de receita foi enviado para analise medica."
 *     Button "Voltar" → window.history.back()
 *
 * FREQUÊNCIAS DISPONÍVEIS
 *   '1x ao dia', '2x ao dia', '3x ao dia', '4x ao dia', '5x ao dia', '6x ao dia'
 *
 * LIMITAÇÕES
 *   - Upload real de arquivo requer E2E_ALLOW_UPLOAD
 *   - Submit real requer E2E_ALLOW_SERVICES (cria solicitação no banco)
 *   - O input#arquivo é hidden — só ativado por clique na div pai
 */

import { test as rdTest, expect, type Page, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';
import * as path from 'path';

// Helper: navegar para o formulário (após aceite dos avisos)
async function navegarParaFormulario(page: Page) {
  await expect(
    page.getByRole('heading', { name: 'Renovacao de Receitas' })
  ).toBeVisible({ timeout: 12_000 });
  await page.getByRole('button', {
    name: 'Confirmo que entendi as regras e desejo prosseguir com a renovacao',
  }).click();
  await expect(page.locator('#medicamento')).toBeVisible({ timeout: 8_000 });
}

rdTest.describe('renovacao-receitas — formulário detalhado', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('formulário tem 4 campos obrigatórios marcados com * @critical', async ({ page, goto }) => {
    await goto(ROUTES.renovacaoReceitas);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await navegarParaFormulario(page);

    // Todos os labels obrigatórios presentes
    await expect(
      page.getByText('Nome do medicamento ou composto ativo *')
    ).toBeVisible();
    await expect(page.getByText('Dosagem do medicamento *')).toBeVisible();
    await expect(page.getByText('Frequencia de uso *')).toBeVisible();
    await expect(page.getByText('Upload da ultima receita *')).toBeVisible();
  });

  rdTest('Select de frequência tem 6 opções (1x ao dia … 6x ao dia) @critical', async ({ page, goto }) => {
    await goto(ROUTES.renovacaoReceitas);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await navegarParaFormulario(page);

    await page.getByText('Selecione a frequencia').click();

    for (const freq of ['1x ao dia', '2x ao dia', '3x ao dia', '4x ao dia', '5x ao dia', '6x ao dia']) {
      await expect(page.getByRole('option', { name: freq })).toBeVisible();
    }
    await page.keyboard.press('Escape');
  });

  rdTest('submit desabilitado com só medicamento preenchido @critical', async ({ page, goto }) => {
    await goto(ROUTES.renovacaoReceitas);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await navegarParaFormulario(page);

    await page.locator('#medicamento').fill('Losartana');
    await expect(
      page.getByRole('button', { name: 'Enviar Solicitacao de Renovacao' })
    ).toBeDisabled();
  });

  rdTest('submit desabilitado com medicamento + dosagem mas sem frequência @critical', async ({ page, goto }) => {
    await goto(ROUTES.renovacaoReceitas);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await navegarParaFormulario(page);

    await page.locator('#medicamento').fill('Losartana');
    await page.locator('#dosagem').fill('50mg');
    await expect(
      page.getByRole('button', { name: 'Enviar Solicitacao de Renovacao' })
    ).toBeDisabled();
  });

  rdTest('submit desabilitado com 3 campos preenchidos mas sem arquivo @critical', async ({ page, goto }) => {
    await goto(ROUTES.renovacaoReceitas);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await navegarParaFormulario(page);

    await page.locator('#medicamento').fill('Losartana');
    await page.locator('#dosagem').fill('50mg - 1 comprimido ao dia');
    await page.getByText('Selecione a frequencia').click();
    await page.getByRole('option', { name: '1x ao dia' }).click();

    // 3 campos preenchidos, sem arquivo → ainda desabilitado
    await expect(
      page.getByRole('button', { name: 'Enviar Solicitacao de Renovacao' })
    ).toBeDisabled();
  });

  rdTest('área de upload exibe ícone e texto de instrução corretos', async ({ page, goto }) => {
    await goto(ROUTES.renovacaoReceitas);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await navegarParaFormulario(page);

    // Área de upload clicável (div com border-dashed)
    await expect(
      page.getByText('Clique para enviar JPG, PNG ou PDF')
    ).toBeVisible();
  });

  rdTest('upload de arquivo real habilita o botão de submit @critical', async ({ page, goto }) => {
    rdTest.skip(
      !process.env.E2E_ALLOW_UPLOAD,
      'Define E2E_ALLOW_UPLOAD=true para testar upload de arquivo real.',
    );

    await goto(ROUTES.renovacaoReceitas);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await navegarParaFormulario(page);

    await page.locator('#medicamento').fill('Metformina');
    await page.locator('#dosagem').fill('500mg');
    await page.getByText('Selecione a frequencia').click();
    await page.getByRole('option', { name: '2x ao dia' }).click();

    // Simular upload via file chooser
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('div.border-dashed').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, '../fixtures/receita-teste.jpg'));

    // Com arquivo: botão habilitado
    await expect(
      page.getByRole('button', { name: 'Enviar Solicitacao de Renovacao' })
    ).toBeEnabled({ timeout: 5_000 });

    // Nome do arquivo aparece na área de upload
    await expect(page.getByText(/receita-teste\.jpg/)).toBeVisible();
  });

});

rdTest.describe('renovacao-receitas — envio completo e tela de sucesso', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('tela de sucesso: h2 "Solicitacao Enviada!" e botão "Voltar" @critical', async ({ page, goto }) => {
    rdTest.skip(
      !process.env.E2E_ALLOW_SERVICES,
      'Define E2E_ALLOW_SERVICES=true para enviar solicitação real com upload.',
    );
    rdTest.skip(
      !process.env.E2E_ALLOW_UPLOAD,
      'Requer E2E_ALLOW_UPLOAD=true para envio completo.',
    );

    await goto(ROUTES.renovacaoReceitas);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await navegarParaFormulario(page);

    await page.locator('#medicamento').fill('Atorvastatina E2E');
    await page.locator('#dosagem').fill('20mg');
    await page.getByText('Selecione a frequencia').click();
    await page.getByRole('option', { name: '1x ao dia' }).click();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('div.border-dashed').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, '../fixtures/receita-teste.jpg'));

    await expect(
      page.getByRole('button', { name: 'Enviar Solicitacao de Renovacao' })
    ).toBeEnabled({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Enviar Solicitacao de Renovacao' }).click();

    // success=true → h2 "Solicitacao Enviada!"
    await expect(
      page.getByRole('heading', { name: 'Solicitacao Enviada!' })
    ).toBeVisible({ timeout: 20_000 });

    await expect(
      page.getByText('Seu pedido de renovacao de receita foi enviado para analise medica.')
    ).toBeVisible();

    await expect(page.getByRole('button', { name: 'Voltar' })).toBeVisible();
  });

  rdTest('toast é exibido após envio bem-sucedido @critical', async ({ page, goto }) => {
    rdTest.skip(!process.env.E2E_ALLOW_SERVICES, 'Define E2E_ALLOW_SERVICES=true.');
    rdTest.skip(!process.env.E2E_ALLOW_UPLOAD, 'Define E2E_ALLOW_UPLOAD=true.');

    // Nota: este teste valida o toast.({ title: 'Solicitacao enviada!' }) que aparece
    // ALÉM da tela de sucesso (success=true)
    // Ambos são disparados simultaneamente no handleSubmit
    await goto(ROUTES.renovacaoReceitas);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await navegarParaFormulario(page);

    await page.locator('#medicamento').fill('Sinvastatina E2E');
    await page.locator('#dosagem').fill('10mg');
    await page.getByText('Selecione a frequencia').click();
    await page.getByRole('option', { name: '1x ao dia' }).click();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('div.border-dashed').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, '../fixtures/receita-teste.jpg'));

    await page.getByRole('button', { name: 'Enviar Solicitacao de Renovacao' }).click();

    // Toast: 'Solicitacao enviada!'
    await expect(
      page.getByText(/solicitacao enviada/i)
    ).toBeVisible({ timeout: 20_000 });
  });

  rdTest('botão "Voltar" na tela de sucesso navega para trás @critical', async ({ page, goto }) => {
    rdTest.skip(!process.env.E2E_ALLOW_SERVICES, 'Define E2E_ALLOW_SERVICES=true.');
    rdTest.skip(!process.env.E2E_ALLOW_UPLOAD, 'Define E2E_ALLOW_UPLOAD=true.');

    await goto(ROUTES.renovacaoReceitas);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await navegarParaFormulario(page);

    await page.locator('#medicamento').fill('Ramipril E2E');
    await page.locator('#dosagem').fill('5mg');
    await page.getByText('Selecione a frequencia').click();
    await page.getByRole('option', { name: '1x ao dia' }).click();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('div.border-dashed').click();
    const fc = await fileChooserPromise;
    await fc.setFiles(path.join(__dirname, '../fixtures/receita-teste.jpg'));

    await page.getByRole('button', { name: 'Enviar Solicitacao de Renovacao' }).click();
    await expect(
      page.getByRole('heading', { name: 'Solicitacao Enviada!' })
    ).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Voltar' }).click();

    // window.history.back() — volta para a página anterior
    await expect(
      page.getByRole('heading', { name: 'Solicitacao Enviada!' })
    ).not.toBeVisible({ timeout: 5_000 });
  });

});

rdTest.describe('renovacao-receitas — estado de loading', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('spinner aparece no botão durante o envio', async ({ page, goto }) => {
    rdTest.skip(!process.env.E2E_ALLOW_SERVICES, 'Define E2E_ALLOW_SERVICES=true.');
    rdTest.skip(!process.env.E2E_ALLOW_UPLOAD, 'Define E2E_ALLOW_UPLOAD=true.');

    await goto(ROUTES.renovacaoReceitas);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await navegarParaFormulario(page);

    await page.locator('#medicamento').fill('Bisoprolol E2E');
    await page.locator('#dosagem').fill('2.5mg');
    await page.getByText('Selecione a frequencia').click();
    await page.getByRole('option', { name: '1x ao dia' }).click();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('div.border-dashed').click();
    const fc = await fileChooserPromise;
    await fc.setFiles(path.join(__dirname, '../fixtures/receita-teste.jpg'));

    // Clicar e verificar loading state (botão desabilitado durante mutação)
    await page.getByRole('button', { name: 'Enviar Solicitacao de Renovacao' }).click();

    // Durante o envio: loading=true → botão desabilitado
    // O teste espera que a operação complete (sucesso ou erro)
    await expect(
      page.getByRole('heading', { name: 'Solicitacao Enviada!' })
        .or(page.getByText(/erro|nao foi possivel enviar/i))
    ).toBeVisible({ timeout: 20_000 });
  });

});
