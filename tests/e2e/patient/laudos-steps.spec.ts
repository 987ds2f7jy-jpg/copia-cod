/**
 * patient/laudos-steps.spec.ts
 *
 * ROTA: /LaudosMedicos
 *
 * Complementa servicos-extras.spec.ts com validacoes de regra do wizard:
 * campos obrigatorios por etapa, navegacao entre steps e documento obrigatorio.
 */

import { type Page } from '@playwright/test';
import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';

async function openLaudosForm(page: Page, goto: (route: string) => Promise<void>) {
  await goto(ROUTES.laudosMedicos);
  await expect(page).not.toHaveURL(/\/Entrar/);
  await expect(page.getByRole('heading', { name: 'Laudos Medicos' }).first()).toBeVisible({
    timeout: 12_000,
  });
  await page.getByRole('button', { name: /confirmo que li os avisos/i }).click();
  await expect(page.getByRole('heading', { name: 'Identificacao' })).toBeVisible({
    timeout: 8_000,
  });
}

async function clearIdentityFields(page: Page) {
  for (const label of [/nome completo/i, /data de nascimento/i, /cpf/i, /telefone/i, /e-mail/i]) {
    await page.getByLabel(label).clear();
  }
}

async function fillIdentityFields(page: Page) {
  await page.getByLabel(/nome completo/i).fill('Paciente E2E Laudo');
  await page.getByLabel(/data de nascimento/i).fill('01/01/1990');
  await page.getByLabel(/cpf/i).fill('123.456.789-09');
  await page.getByLabel(/telefone/i).fill('(11) 99999-0000');
  await page.getByLabel(/e-mail/i).fill('paciente-laudo-e2e@example.com');
}

async function reachHealthStep(page: Page, goto: (route: string) => Promise<void>) {
  await openLaudosForm(page, goto);
  await clearIdentityFields(page);
  await fillIdentityFields(page);
  await page.getByRole('button', { name: 'Proxima' }).click();
  await expect(page.getByRole('heading', { name: 'Informacoes de Saude' })).toBeVisible({
    timeout: 8_000,
  });
}

async function reachLaudoSpecStep(page: Page, goto: (route: string) => Promise<void>) {
  await reachHealthStep(page, goto);
  await page.getByLabel(/diagnostico atual/i).fill('Diagnostico E2E para laudo');
  await page.getByRole('button', { name: 'Proxima' }).click();
  await expect(page.getByRole('heading', { name: 'Especificacao do Laudo' })).toBeVisible({
    timeout: 8_000,
  });
}

async function selectLaudoType(page: Page) {
  const combo = page.getByRole('combobox', { name: /tipo de laudo/i });
  if ((await combo.count()) > 0) {
    await combo.click();
  } else {
    await page.getByText('Selecione o tipo').click();
  }
  await page.getByRole('option', { name: /Afastamento medico/i }).click();
}

async function reachDocumentsStep(page: Page, goto: (route: string) => Promise<void>) {
  await reachLaudoSpecStep(page, goto);
  await selectLaudoType(page);
  await page.getByLabel(/finalidade do laudo/i).fill('Comprovacao E2E de finalidade.');
  await page.getByRole('button', { name: 'Proxima' }).click();
  await expect(page.getByRole('heading', { name: 'Documentos de Apoio' })).toBeVisible({
    timeout: 8_000,
  });
}

rdTest.describe('laudos-steps - wizard de laudo medico', () => {
  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('step Identificacao exige os cinco campos obrigatorios @critical', async ({
    page,
    goto,
  }) => {
    await openLaudosForm(page, goto);
    await clearIdentityFields(page);

    await expect(page.getByLabel(/nome completo/i)).toBeVisible();
    await expect(page.getByLabel(/data de nascimento/i)).toBeVisible();
    await expect(page.getByLabel(/cpf/i)).toBeVisible();
    await expect(page.getByLabel(/telefone/i)).toBeVisible();
    await expect(page.getByLabel(/e-mail/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Proxima' })).toBeDisabled();

    await page.getByLabel(/nome completo/i).fill('Paciente Parcial');
    await expect(page.getByRole('button', { name: 'Proxima' })).toBeDisabled();

    await clearIdentityFields(page);
    await fillIdentityFields(page);
    await expect(page.getByRole('button', { name: 'Proxima' })).toBeEnabled();
  });

  rdTest('indicador do wizard mostra as quatro etapas esperadas', async ({ page, goto }) => {
    await openLaudosForm(page, goto);

    for (const stepName of ['Identificacao', 'Saude', 'Laudo', 'Documentos']) {
      await expect(page.getByText(stepName).first()).toBeVisible();
    }
  });

  rdTest('step Saude exige diagnostico e permite voltar para Identificacao @critical', async ({
    page,
    goto,
  }) => {
    await reachHealthStep(page, goto);

    await expect(page.getByLabel(/diagnostico atual/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Proxima' })).toBeDisabled();

    await page.getByLabel(/diagnostico atual/i).fill('Ansiedade em acompanhamento.');
    await expect(page.getByRole('button', { name: 'Proxima' })).toBeEnabled();

    await page.getByRole('button', { name: 'Anterior' }).click();
    await expect(page.getByRole('heading', { name: 'Identificacao' })).toBeVisible();
  });

  rdTest('step Saude exibe campos clinicos opcionais', async ({ page, goto }) => {
    await reachHealthStep(page, goto);

    await expect(page.getByLabel(/historico clinico/i)).toBeVisible();
    await expect(page.getByLabel(/doencas cronicas/i)).toBeVisible();
    await expect(page.getByLabel(/alergias/i)).toBeVisible();
    await expect(page.getByLabel(/medicamentos em uso/i)).toBeVisible();
  });

  rdTest('step Laudo exige tipo e finalidade antes dos documentos @critical', async ({
    page,
    goto,
  }) => {
    await reachLaudoSpecStep(page, goto);

    await expect(page.getByText(/Tipo de laudo solicitado/i)).toBeVisible();
    await expect(page.getByLabel(/finalidade do laudo/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Proxima' })).toBeDisabled();

    await selectLaudoType(page);
    await page.getByLabel(/finalidade do laudo/i).fill('Uso em afastamento temporario.');
    await expect(page.getByRole('button', { name: 'Proxima' })).toBeEnabled();
  });

  rdTest('step Documentos exige identidade antes de iniciar consulta @critical', async ({
    page,
    goto,
  }) => {
    await reachDocumentsStep(page, goto);

    await expect(page.getByLabel(/Documento de identidade/i)).toBeVisible();
    await expect(page.getByLabel(/Exames recentes/i)).toBeVisible();
    await expect(page.getByLabel(/Relatorios medicos/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /continuar e iniciar consulta/i }),
    ).toBeDisabled();
  });
});
