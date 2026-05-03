/**
 * patient/meu-prontuario.spec.ts
 *
 * Fluxo coberto:
 * - Menu do paciente com "Meu Prontuario"
 * - Rota /MeuProntuario consumindo get-patient-prontuarios
 * - Estado vazio, card com prontuario, modal e linkificacao segura
 * - Menu profissional nao exibe a entrada exclusiva do paciente
 */

import { test as rdTest, expect } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { openUserMenu } from '../support/page-helpers';
import {
  edgeOk,
  fulfillJson,
  mockAuthForRole,
} from '../support/edge-mocks';

const MEU_PRONTUARIO_RE = /Meu Prontu(?:a|á|Ã¡)rio/i;
const VER_PRONTUARIO_RE = /Ver prontu(?:a|á|Ã¡)rio/i;
const PLANO_TERAPEUTICO_RE = /Plano terap(?:e|ê|Ãª)utico/i;

const prontuarioItem = {
  id: 'prontuario-e2e-1',
  consulta_id: 'consulta-e2e-1',
  appointment_id: 'appointment-e2e-1',
  solicitacao_exame_id: 'solicitacao-e2e-1',
  data: '2026-04-29',
  horario: '08:40',
  tipo_atendimento: 'Check-up',
  categoria: 'extra',
  status: 'documento_disponivel',
  profissional_nome: 'Dr. Joao Silva',
  especialidade: 'Clinico Geral',
  plano: 'Orientacoes gerais. Seguir receita: https://exemplo.com/receita Retorno em 30 dias.',
  service_code: 'extra_checkup',
  created_at: '2026-04-29T08:40:00.000Z',
  updated_at: '2026-04-29T09:00:00.000Z',
};

async function mockPatientProntuarios(page, items) {
  await page.route('**/functions/v1/get-patient-prontuarios', async (route) => {
    await fulfillJson(route, 200, edgeOk({ items }));
  });
}

async function mockProfessionalDashboard(page) {
  await page.route('**/functions/v1/get-professional-dashboard', async (route) => {
    await fulfillJson(route, 200, edgeOk({
      professional: {
        id: 'professional-profile-e2e',
        user_id: 'professional-app-user-e2e',
        full_name: 'Dr. Profissional E2E',
        specialty: 'Clinico Geral',
        profession: 'Medicina',
        status: 'approved',
        is_verified: true,
        is_active: true,
      },
      publicProfile: {
        id: 'professional-public-e2e',
        professional_profile_id: 'professional-profile-e2e',
        full_name: 'Dr. Profissional E2E',
        specialty: 'Clinico Geral',
        status: 'approved',
        is_on_duty: false,
      },
      appointments: [],
      queueWaiting: [],
      queueAll: [],
      pendingQuestions: [],
      answeredQuestions: [],
      reviews: [],
    }));
  });
}

rdTest.describe('Meu Prontuario - paciente', () => {
  rdTest.beforeEach(async ({ page }) => {
    await mockAuthForRole(page, 'patient');
  });

  rdTest('menu do paciente exibe Meu Prontuario entre Minhas Consultas e Configuracoes @critical', async ({
    page,
    goto,
  }) => {
    await mockPatientProntuarios(page, []);
    await goto(ROUTES.meuProntuario);

    await openUserMenu(page);

    const menuItems = await page.getByRole('menuitem').allTextContents();
    const minhasConsultasIndex = menuItems.findIndex((text) => /Minhas Consultas/i.test(text));
    const meuProntuarioIndex = menuItems.findIndex((text) => MEU_PRONTUARIO_RE.test(text));
    const configuracoesIndex = menuItems.findIndex((text) => /Configura(?:c|ç|Ã§)(?:o|õ|Ãµ)es/i.test(text));

    expect(minhasConsultasIndex).toBeGreaterThanOrEqual(0);
    expect(meuProntuarioIndex).toBeGreaterThan(minhasConsultasIndex);
    expect(configuracoesIndex).toBeGreaterThan(meuProntuarioIndex);

    await page.getByRole('menuitem', { name: MEU_PRONTUARIO_RE }).click();
    await expect(page).toHaveURL(/\/MeuProntuario/, { timeout: 10_000 });
  });

  rdTest('estado vazio informa que ainda nao ha prontuarios', async ({ page, goto }) => {
    await mockPatientProntuarios(page, []);
    await goto(ROUTES.meuProntuario);

    await expect(page.getByRole('heading', { name: MEU_PRONTUARIO_RE })).toBeVisible({
      timeout: 12_000,
    });
    await expect(page.getByText(/Nenhum prontu(?:a|á|Ã¡)rio dispon(?:i|í|Ã­)vel ainda/i)).toBeVisible();
  });

  rdTest('lista prontuario real e abre modal com plano terapeutico', async ({ page, goto }) => {
    await mockPatientProntuarios(page, [prontuarioItem]);
    await goto(ROUTES.meuProntuario);

    await expect(page.getByText('29 de abril de 2026')).toBeVisible({ timeout: 12_000 });
    await expect(page.getByText('08:40')).toBeVisible();
    await expect(page.getByText('Check-up').first()).toBeVisible();
    await expect(page.getByText('Dr. Joao Silva')).toBeVisible();
    await expect(page.getByText('Clinico Geral').first()).toBeVisible();

    await page.getByRole('button', { name: VER_PRONTUARIO_RE }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText(/Plano da consulta/i)).toBeVisible();
    await expect(dialog.getByText(PLANO_TERAPEUTICO_RE)).toBeVisible();
    await expect(dialog.getByText(/Orientacoes gerais/i)).toBeVisible();
  });

  rdTest('linkifica URLs do plano com link seguro', async ({ page, goto }) => {
    await mockPatientProntuarios(page, [prontuarioItem]);
    await goto(ROUTES.meuProntuario);

    await page.getByRole('button', { name: VER_PRONTUARIO_RE }).click();

    const link = page.getByRole('link', { name: 'https://exemplo.com/receita' });
    await expect(link).toBeVisible({ timeout: 5_000 });
    await expect(link).toHaveAttribute('href', 'https://exemplo.com/receita');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  });
});

rdTest.describe('Meu Prontuario - restricao por perfil', () => {
  rdTest.beforeEach(async ({ page }) => {
    await mockAuthForRole(page, 'professional');
    await mockProfessionalDashboard(page);
  });

  rdTest('menu do profissional nao exibe Meu Prontuario', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await expect(page).toHaveURL(/\/DashboardProfissional/, { timeout: 12_000 });

    await openUserMenu(page);

    await expect(page.getByRole('menuitem', { name: MEU_PRONTUARIO_RE })).toHaveCount(0);
  });
});

