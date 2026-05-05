/**
 * patient/meus-pagamentos.spec.ts
 *
 * Fluxo coberto:
 * - Menu do paciente com "Meus Pagamentos" entre "Meu Prontuario" e "Configuracoes"
 * - Rota /MeusPagamentos consumindo get-patient-payments
 * - Cards com status/valor, modal de detalhes e checkout apenas para pendentes
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
const MEUS_PAGAMENTOS_RE = /Meus Pagamentos/i;
const CONFIGURACOES_RE = /Configura(?:c|ç|Ã§)(?:o|õ|Ãµ)es/i;

const paymentItems = [
  {
    id: 'payment-paid-e2e-0001',
    owner_type: 'appointment',
    owner_id: 'appointment-paid-e2e',
    attempt_number: 1,
    is_current: true,
    status: 'paid',
    amount: 96,
    currency: 'BRL',
    provider: 'mercado_pago',
    checkout_url: '',
    external_reference: 'rd-paid-ref-e2e',
    created_at: '2026-05-04T11:30:00.000Z',
    paid_at: '2026-05-04T11:35:00.000Z',
    service_code: 'specialty_request',
    service_type: 'Consulta por especialidade',
    specialty: 'Clínico Geral',
    professional_name: 'Dr. Joao Silva',
    patient_name: 'Wesley Paciente Teste',
  },
  {
    id: 'payment-pending-e2e-0002',
    owner_type: 'queue',
    owner_id: 'queue-pending-e2e',
    attempt_number: 2,
    is_current: true,
    status: 'payment_pending',
    amount: 120,
    currency: 'BRL',
    provider: 'mercado_pago',
    checkout_url: 'https://checkout.example.test/pending',
    external_reference: 'rd-pending-ref-e2e',
    created_at: '2026-05-04T12:10:00.000Z',
    expires_at: '2026-05-04T13:10:00.000Z',
    service_code: 'on_duty_pediatria',
    service_type: 'Plantão - Pediatria',
    specialty: 'Pediatria',
    patient_name: 'Wesley Paciente Teste',
  },
  {
    id: 'payment-failed-e2e-0003',
    owner_type: 'solicitacao_exame',
    owner_id: 'solicitacao-failed-e2e',
    attempt_number: 1,
    is_current: false,
    status: 'payment_failed',
    amount: 70,
    currency: 'BRL',
    provider: 'mercado_pago',
    checkout_url: '',
    external_reference: 'rd-failed-ref-e2e',
    failure_reason: 'Pagamento recusado no provedor.',
    created_at: '2026-05-03T08:00:00.000Z',
    failed_at: '2026-05-03T08:05:00.000Z',
    service_code: 'extra_checkup',
    service_type: 'Check-up',
    patient_name: 'Wesley Paciente Teste',
  },
];

async function mockPatientPayments(page, items = paymentItems) {
  await page.route('**/functions/v1/get-patient-payments', async (route) => {
    await fulfillJson(route, 200, edgeOk({
      items,
      summary: {
        total_paid: 96,
        total_pending: 120,
        total_failed: 70,
        count: items.length,
      },
    }));
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
      serviceRequests: [],
    }));
  });
}

rdTest.describe('Meus Pagamentos - paciente', () => {
  rdTest.beforeEach(async ({ page }) => {
    await mockAuthForRole(page, 'patient');
    await mockPatientPayments(page);
  });

  rdTest('menu do paciente exibe Meus Pagamentos na ordem correta @critical', async ({ page, goto }) => {
    await goto(ROUTES.meusPagamentos);

    await openUserMenu(page);

    const menuItems = await page.getByRole('menuitem').allTextContents();
    const minhasConsultasIndex = menuItems.findIndex((text) => /Minhas Consultas/i.test(text));
    const meuProntuarioIndex = menuItems.findIndex((text) => MEU_PRONTUARIO_RE.test(text));
    const meusPagamentosIndex = menuItems.findIndex((text) => MEUS_PAGAMENTOS_RE.test(text));
    const configuracoesIndex = menuItems.findIndex((text) => CONFIGURACOES_RE.test(text));

    expect(minhasConsultasIndex).toBeGreaterThanOrEqual(0);
    expect(meuProntuarioIndex).toBeGreaterThan(minhasConsultasIndex);
    expect(meusPagamentosIndex).toBeGreaterThan(meuProntuarioIndex);
    expect(configuracoesIndex).toBeGreaterThan(meusPagamentosIndex);

    await page.getByRole('menuitem', { name: MEUS_PAGAMENTOS_RE }).click();
    await expect(page).toHaveURL(/\/MeusPagamentos/, { timeout: 10_000 });
  });

  rdTest('renderiza pagamentos com status, valores e detalhes', async ({ page, goto }) => {
    await goto(ROUTES.meusPagamentos);

    await expect(page.getByRole('heading', { name: MEUS_PAGAMENTOS_RE })).toBeVisible({
      timeout: 12_000,
    });

    await expect(page.getByText('Consulta por especialidade').first()).toBeVisible();
    await expect(page.getByText('Plantão - Pediatria').first()).toBeVisible();
    await expect(page.getByText('Check-up').first()).toBeVisible();

    await expect(page.getByText('Pagamento confirmado')).toBeVisible();
    await expect(page.getByText('Aguardando pagamento')).toBeVisible();
    await expect(page.getByText('Pagamento recusado')).toBeVisible();

    await expect(page.getByText('R$ 96,00').first()).toBeVisible();
    await expect(page.getByText('R$ 120,00').first()).toBeVisible();
    await expect(page.getByText('04 de maio de 2026').first()).toBeVisible();

    await page.getByRole('button', { name: /Ver detalhes/i }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText(/Detalhes do pagamento/i)).toBeVisible();
    await expect(dialog.getByText(/rd-paid-ref-e2e/i)).toBeVisible();
    await expect(dialog.getByText('Tentativa', { exact: true })).toBeVisible();
  });

  rdTest('detalhes de pagamento pendente exibem link seguro de checkout', async ({ page, goto }) => {
    await goto(ROUTES.meusPagamentos);

    await page.getByRole('button', { name: /Ver detalhes/i }).nth(1).click();

    const checkout = page.getByRole('link', { name: /Abrir checkout/i });
    await expect(checkout).toBeVisible({ timeout: 5_000 });
    await expect(checkout).toHaveAttribute('href', 'https://checkout.example.test/pending');
    await expect(checkout).toHaveAttribute('target', '_blank');
    await expect(checkout).toHaveAttribute('rel', /noopener/);
  });

  rdTest('estado vazio aparece sem quebrar a pagina', async ({ page, goto }) => {
    await mockPatientPayments(page, []);
    await goto(ROUTES.meusPagamentos);

    await expect(page.getByRole('heading', { name: MEUS_PAGAMENTOS_RE })).toBeVisible({
      timeout: 12_000,
    });
    await expect(page.getByText(/Nenhum pagamento encontrado/i)).toBeVisible();
  });
});

rdTest.describe('Meus Pagamentos - restricao por perfil', () => {
  rdTest.beforeEach(async ({ page }) => {
    await mockAuthForRole(page, 'professional');
    await mockProfessionalDashboard(page);
  });

  rdTest('menu do profissional nao exibe Meus Pagamentos', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);
    await expect(page).toHaveURL(/\/DashboardProfissional/, { timeout: 12_000 });

    await openUserMenu(page);

    await expect(page.getByRole('menuitem', { name: MEUS_PAGAMENTOS_RE })).toHaveCount(0);
  });
});
