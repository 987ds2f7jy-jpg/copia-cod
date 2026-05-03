/**
 * professional/servicos-extras-atendimento.spec.ts
 *
 * Fluxo coberto:
 * - Card "Servicos Extras" no Dashboard Profissional
 * - Aceite seguro via accept-solicitacao-exame
 * - Rota /AtenderServicoExtra?solicitacao=:id
 * - Finalizacao mockada com finish-solicitacao-exame-atendimento
 */

import { test as rdTest, expect } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import {
  edgeError,
  edgeOk,
  fulfillJson,
  mockAuthForRole,
} from '../support/edge-mocks';

const SOLICITACAO_ID = 'solicitacao-extra-e2e-1';

const directSolicitacao = {
  id: SOLICITACAO_ID,
  paciente_id: 'patient-extra-e2e',
  paciente_nome: 'Wesley Paciente Teste',
  tipo: 'renovacao_receitas',
  status: 'pending',
  fluxo_destino: 'dashboard',
  especialidade_destino: 'clinico_geral',
  payment_status: 'paid',
  quoted_professional_net_amount: 78.2,
  nome_medicamento: 'Losartana',
  dosagem: '50mg',
  frequencia: '1x ao dia',
  arquivo_receita_url: 'https://exemplo.com/receita-original.pdf',
  created_date: '2026-04-27T22:50:00.000Z',
};

const acceptedSolicitacao = {
  ...directSolicitacao,
  status: 'in_progress',
  medico_id: 'professional-profile-e2e',
  accepted_at: '2026-04-27T23:00:00.000Z',
};

const dashboardPayload = {
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
};

const patientSummariesPayload = {
  patientSummaries: [
    {
      id: 'patient-extra-e2e',
      fullName: 'Wesley Paciente Teste',
      birthDate: '1996-04-20',
      sex: 'masculino',
      latestRiskHistory: 'Sem alergias registradas',
    },
  ],
};

const atendimentoPayload = {
  solicitacaoExame: {
    ...acceptedSolicitacao,
    motivo: 'Renovacao de tratamento continuo',
    sintomas: '',
  },
  patient: {
    id: 'patient-extra-e2e',
    fullName: 'Wesley Paciente Teste',
    birthDate: '1996-04-20',
    sex: 'masculino',
  },
};

async function mockProfessionalShell(page) {
  await mockAuthForRole(page, 'professional');
  await page.route('**/functions/v1/get-professional-dashboard', async (route) => {
    await fulfillJson(route, 200, edgeOk(dashboardPayload));
  });
}

async function mockDashboardSolicitacoes(page, records = [directSolicitacao]) {
  await page.route('**/functions/v1/read-models', async (route) => {
    let body = null;
    try {
      body = route.request().postDataJSON();
    } catch {
      body = null;
    }

    if (body?.entity === 'SolicitacaoExame') {
      await fulfillJson(route, 200, edgeOk({ records }));
      return;
    }

    await fulfillJson(route, 200, edgeOk({ records: [] }));
  });

  await page.route('**/functions/v1/get-teleconsulta-context', async (route) => {
    await fulfillJson(route, 200, edgeOk(patientSummariesPayload));
  });
}

async function mockAtendimentoRead(page, payload = atendimentoPayload) {
  await page.route('**/functions/v1/get-solicitacao-exame-atendimento', async (route) => {
    await fulfillJson(route, 200, edgeOk(payload));
  });
}

async function openDashboardWithServicoExtra(page, goto) {
  await mockProfessionalShell(page);
  await mockDashboardSolicitacoes(page);
  await goto(ROUTES.dashboardProfissional);
  await expect(page.getByRole('heading', { name: /Servicos Extras/i })).toBeVisible({
    timeout: 15_000,
  });
}

rdTest.describe('Servicos Extras - Dashboard Profissional', () => {
  rdTest('exibe solicitacao paga pendente com badge de valor e botao de atendimento', async ({
    page,
    goto,
  }) => {
    await openDashboardWithServicoExtra(page, goto);

    await expect(page.getByText('Wesley Paciente Teste').first()).toBeVisible();
    await expect(page.getByText('Renovacao de Receitas')).toBeVisible();
    await expect(page.getByText('Losartana')).toBeVisible();
    await expect(page.getByText('R$ 78,20')).toBeVisible();
    await expect(page.getByRole('button', { name: /Atender Solicitacao/i })).toBeVisible();
  });

  rdTest('aceita solicitacao e navega para atendimento assincrono', async ({ page, goto }) => {
    await mockAtendimentoRead(page);
    await page.route('**/functions/v1/accept-solicitacao-exame', async (route) => {
      await fulfillJson(route, 200, edgeOk({ solicitacaoExame: acceptedSolicitacao }));
    });

    await openDashboardWithServicoExtra(page, goto);

    await page.getByRole('button', { name: /Atender Solicitacao/i }).click();

    await expect(page.getByText('Solicitacao aceita', { exact: true })).toBeVisible({ timeout: 8_000 });
    await expect(page).toHaveURL(/\/AtenderServicoExtra\?solicitacao=solicitacao-extra-e2e-1/, {
      timeout: 10_000,
    });
    await expect(page.getByRole('heading', { name: 'Atendimento de Servico Extra' })).toBeVisible();
  });

  const acceptErrors = [
    {
      title: 'ja aceita por outro profissional',
      status: 409,
      code: 'SOLICITACAO_EXAME_ALREADY_ACCEPTED',
      message: 'Solicitacao ja foi aceita por outro profissional.',
    },
    {
      title: 'pagamento nao confirmado',
      status: 422,
      code: 'SOLICITACAO_EXAME_PAYMENT_REQUIRED',
      message: 'Pagamento ainda nao confirmado.',
    },
    {
      title: 'usuario nao autorizado',
      status: 403,
      code: 'PROFESSIONAL_ROLE_REQUIRED',
      message: 'Apenas profissionais podem aceitar esta solicitacao.',
    },
  ];

  for (const scenario of acceptErrors) {
    rdTest(`erro de aceite: ${scenario.title}`, async ({ page, goto }) => {
      await page.route('**/functions/v1/accept-solicitacao-exame', async (route) => {
        await fulfillJson(route, scenario.status, edgeError(scenario.code, scenario.message));
      });

      await openDashboardWithServicoExtra(page, goto);

      await page.getByRole('button', { name: /Atender Solicitacao/i }).click();

      await expect(page.getByText('Nao foi possivel aceitar a solicitacao', { exact: true })).toBeVisible({
        timeout: 8_000,
      });
      await expect(page.getByText(scenario.message, { exact: true })).toBeVisible();
      await expect(page).toHaveURL(/\/DashboardProfissional/);
    });
  }
});

rdTest.describe('AtenderServicoExtra - atendimento assincrono', () => {
  rdTest.beforeEach(async ({ page }) => {
    await mockProfessionalShell(page);
  });

  rdTest('carrega dados da solicitacao aceita', async ({ page, goto }) => {
    await mockAtendimentoRead(page);
    await goto(ROUTES.atenderServicoExtra(SOLICITACAO_ID));

    await expect(page.getByRole('heading', { name: 'Atendimento de Servico Extra' })).toBeVisible({
      timeout: 12_000,
    });
    await expect(page.getByText('Renovacao de receita').first()).toBeVisible();
    await expect(page.getByText('Wesley Paciente Teste').first()).toBeVisible();
    await expect(page.getByText('Em atendimento').first()).toBeVisible();
    await expect(page.getByText('R$ 78,20')).toBeVisible();
    await expect(page.getByPlaceholder(/Digite as orientacoes/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Finalizar atendimento' })).toBeVisible();
  });

  rdTest('mantem finalizacao bloqueada com plano vazio', async ({ page, goto }) => {
    let finishCalled = false;
    await mockAtendimentoRead(page);
    await page.route('**/functions/v1/finish-solicitacao-exame-atendimento', async (route) => {
      finishCalled = true;
      await fulfillJson(route, 200, edgeOk({}));
    });

    await goto(ROUTES.atenderServicoExtra(SOLICITACAO_ID));

    await expect(page.getByRole('button', { name: 'Finalizar atendimento' })).toBeDisabled({
      timeout: 12_000,
    });
    await page.waitForTimeout(300);
    expect(finishCalled).toBe(false);
  });

  rdTest('finaliza atendimento com plano e retorna ao dashboard', async ({ page, goto }) => {
    await mockAtendimentoRead(page);
    await page.route('**/functions/v1/read-models', async (route) => {
      await fulfillJson(route, 200, edgeOk({ records: [] }));
    });
    await page.route('**/functions/v1/get-teleconsulta-context', async (route) => {
      await fulfillJson(route, 200, edgeOk(patientSummariesPayload));
    });
    await page.route('**/functions/v1/finish-solicitacao-exame-atendimento', async (route) => {
      await fulfillJson(route, 200, edgeOk({
        solicitacaoExame: {
          ...acceptedSolicitacao,
          status: 'completed',
          completed_at: '2026-04-27T23:10:00.000Z',
          consulta_id: 'consulta-extra-e2e',
        },
        consulta: {
          id: 'consulta-extra-e2e',
        },
        prontuario: {
          id: 'prontuario-extra-e2e',
          consulta_id: 'consulta-extra-e2e',
          recomendacoes: 'Orientacoes e receita em https://exemplo.com/receita',
        },
      }));
    });

    await goto(ROUTES.atenderServicoExtra(SOLICITACAO_ID));

    await page.getByPlaceholder(/Digite as orientacoes/i).fill(
      'Orientacoes gerais. Receita: https://exemplo.com/receita',
    );
    await page.getByRole('button', { name: 'Finalizar atendimento' }).click();

    await expect(page.getByText('Atendimento finalizado', { exact: true })).toBeVisible({ timeout: 8_000 });
    await expect(page).toHaveURL(/\/DashboardProfissional/, { timeout: 10_000 });
  });

  rdTest('erro na finalizacao mostra mensagem e permanece na tela', async ({ page, goto }) => {
    await mockAtendimentoRead(page);
    await page.route('**/functions/v1/finish-solicitacao-exame-atendimento', async (route) => {
      await fulfillJson(route, 422, edgeError(
        'SOLICITACAO_EXAME_PAYMENT_REQUIRED',
        'Pagamento ainda nao confirmado.',
      ));
    });

    await goto(ROUTES.atenderServicoExtra(SOLICITACAO_ID));

    await page.getByPlaceholder(/Digite as orientacoes/i).fill('Plano com conduta e orientacoes.');
    await page.getByRole('button', { name: 'Finalizar atendimento' }).click();

    await expect(page.getByText('Falha ao finalizar atendimento', { exact: true })).toBeVisible({
      timeout: 8_000,
    });
    await expect(page.getByText('Pagamento ainda nao confirmado.', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/AtenderServicoExtra\?solicitacao=solicitacao-extra-e2e-1/);
  });
});
