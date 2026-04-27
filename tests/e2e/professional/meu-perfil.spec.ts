/**
 * professional/meu-perfil.spec.ts
 *
 * TIPO: Regra de negócio
 *
 * PROPÓSITO
 *   Cobrir a aba "Meu Perfil" do DashboardProfissional (componente MeuPerfil.jsx).
 *   O professional-dashboard.spec.ts existente apenas valida que a aba é acessível.
 *   Este arquivo cobre os campos, validações e feedback visual da edição de perfil.
 *
 * SELETORES REAIS (MeuPerfil.jsx)
 *   Seções (CardTitle):
 *     "Foto de Perfil"
 *     "Apresentacao"         (sem acento)
 *     "Disponibilidade"
 *     "Localizacao"          (sem acento)
 *     "Valores por Consulta" (ou similar)
 *     "Galeria de Fotos"
 *
 *   Campos:
 *     Textarea placeholder "Escreva uma apresentacao profissional..." (#bio)
 *     Input "Experiencia em anos" / #experience_years
 *     TagInput para especialidades/tags
 *     Switch de disponibilidade (Ativo/Inativo)
 *
 *   Botão de salvar:
 *     button "Salvar Alterações" (com acento — diferente do /Perfil que é sem acento)
 *     Estado de sucesso: botão muda ou toast aparece
 *
 * ACESSO
 *   Requer: role=professional + storageState válido
 *   Navegação: DashboardProfissional → clicar em "Meu Perfil"
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';
import { clickProfessionalTab, waitForProfessionalDashboard } from '../support/page-helpers';

rdTest.describe('meu-perfil — acesso e estrutura', () => {

  rdTest.use({ storageState: AUTH_STATE.professional });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'professional');
  });

  rdTest('aba "Meu Perfil" está visível no DashboardProfissional @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await expect(
      page.getByRole('button', { name: 'Meu Perfil', exact: true })
    ).toBeVisible();
  });

  rdTest('clicar em "Meu Perfil" exibe seção de foto e apresentação @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await clickProfessionalTab(page, 'perfil');

    await expect(
      page.getByText('Foto de Perfil')
        .or(page.getByText('Apresentacao'))
    ).toBeVisible({ timeout: 10_000 });
  });

  rdTest('seção "Apresentacao" com textarea de bio está presente @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await clickProfessionalTab(page, 'perfil');

    await expect(
      page.getByText('Apresentacao')
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByPlaceholder(/escreva uma apresentacao profissional/i)
    ).toBeVisible();
  });

  rdTest('botão "Salvar Alterações" existe na aba Meu Perfil @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await clickProfessionalTab(page, 'perfil');

    await expect(
      page.getByText('Apresentacao')
    ).toBeVisible({ timeout: 10_000 });

    // MeuPerfil.jsx usa "Salvar Alterações" (com acento — diferente do /Perfil)
    await expect(
      page.getByRole('button', { name: /salvar alterações|salvar alteracoes/i }).first()
    ).toBeVisible();
  });

  rdTest('seção "Disponibilidade" existe com controle de status @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await clickProfessionalTab(page, 'perfil');

    await expect(
      page.getByText('Apresentacao')
    ).toBeVisible({ timeout: 10_000 });

    // Scroll para a seção de disponibilidade se necessário
    await expect(
      page.getByText(/disponibilidade/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  rdTest('editar bio e salvar exibe feedback de sucesso @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);
    await clickProfessionalTab(page, 'perfil');

    await expect(
      page.getByPlaceholder(/escreva uma apresentacao profissional/i)
    ).toBeVisible({ timeout: 10_000 });

    const bioField = page.getByPlaceholder(/escreva uma apresentacao profissional/i);
    await bioField.clear();
    await bioField.fill('Profissional E2E — perfil de teste atualizado em ' + new Date().toISOString());

    const saveBtn = page.getByRole('button', { name: /salvar alterações|salvar alteracoes/i }).first();
    await saveBtn.click();

    // Feedback: toast de sucesso ou botão muda de texto
    await expect(
      page.getByText(/salvo|sucesso|perfil.*atualizado/i)
        .or(page.getByRole('button', { name: /salvo!/i }))
    ).toBeVisible({ timeout: 12_000 });
  });

  rdTest('voltar para aba Dashboard preserva estado do perfil', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await waitForProfessionalDashboard(page);

    await clickProfessionalTab(page, 'perfil');
    await expect(
      page.getByText('Apresentacao')
    ).toBeVisible({ timeout: 10_000 });

    // Voltar para aba Dashboard
    await clickProfessionalTab(page, 'dashboard');

    // KPIs devem estar visíveis novamente
    await expect(page.getByText('Consultas realizadas')).toBeVisible({ timeout: 8_000 });

    // Retornar para Meu Perfil — dados ainda lá
    await clickProfessionalTab(page, 'perfil');
    await expect(
      page.getByPlaceholder(/escreva uma apresentacao profissional/i)
    ).toBeVisible({ timeout: 8_000 });
  });

});
