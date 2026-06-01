/**
 * patient/meus-planos.spec.ts
 *
 * ROTA: /MeusPlanos
 *
 * Garante que a pagina deixou de depender de mock local e passou a consumir
 * a Edge Function get-my-plans sem tocar pagamento, consulta ou consumo.
 */

import { test as rdTest, expect } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import {
  edgeOk,
  fulfillJson,
  mockAuthForRole,
} from '../support/edge-mocks';

const MY_PLANS_RESPONSE = {
  state: 'active',
  currentPlan: {
    id: 'plan-order-e2e',
    planCode: 'family',
    name: 'Familiar',
    status: 'active',
    paymentStatus: 'paid',
    amount: 249.9,
    currency: 'BRL',
    createdAt: '2026-05-01T10:00:00.000Z',
    paidAt: '2026-05-01T10:02:00.000Z',
    activatedAt: '2026-05-01T10:03:00.000Z',
    nextRenewalAt: null,
    renewalDayLabel: 'Todo dia 1',
    plansServiceSubscriptionId: 'external-subscription-e2e',
  },
  credits: [
    {
      code: 'clinico_geral',
      label: 'Clinico Geral',
      included: true,
      available: 1,
      used: 0,
      total: 1,
      source: 'plans_service',
    },
    {
      code: 'nutricao',
      label: 'Nutricao',
      included: false,
      available: 0,
      used: 0,
      total: 0,
      source: 'plans_service',
    },
  ],
  coverage: {
    included: ['Consulta com clinico geral', 'Pediatria'],
    notIncluded: ['Consulta por perfil do profissional', 'Servicos extras'],
    source: 'catalog_estimate',
  },
  usageHistory: [],
  creditsSource: 'plans_service',
  creditsSourceReason: null,
  creditsLastSyncedAt: '2026-06-01T10:00:00.000Z',
  dependents: {
    enabled: true,
    holderName: 'Wesley Paciente Teste',
    used: 0,
    limit: 3,
    items: [],
  },
  actions: {
    canContractNewPlan: true,
    canRetryActivation: false,
    canAddDependent: false,
  },
};

rdTest.describe('Meus Planos - paciente', () => {
  rdTest('carrega dados reais pela Edge Function get-my-plans', async ({ page, goto }) => {
    let payload: Record<string, unknown> | null = null;
    let directPlansServiceCalls = 0;

    await mockAuthForRole(page, 'patient');
    await page.route('**/functions/v1/get-my-plans', async (route) => {
      payload = route.request().postDataJSON();
      await fulfillJson(route, 200, edgeOk(MY_PLANS_RESPONSE));
    });
    await page.route('**/plans/external/scores', async (route) => {
      directPlansServiceCalls += 1;
      await route.abort();
    });

    await goto(ROUTES.meusPlanos);

    await expect.poll(() => payload).toEqual({});
    await expect(page.getByRole('heading', { name: 'Meus Planos' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Familiar', level: 2 })).toBeVisible();
    await expect(page.getByText('R$ 249,90/mês')).toBeVisible();
    await expect(page.getByText('Créditos atualizados pelo plano')).toBeVisible();
    await expect(page.getByText('Clinico Geral', { exact: true })).toBeVisible();
    await expect(page.getByText('Consulta com clinico geral')).toBeVisible();
    await expect(page.getByText('0 de 3 dependentes')).toBeVisible();
    await expect(page.getByText('Nenhum uso registrado ainda.')).toBeVisible();
    expect(directPlansServiceCalls).toBe(0);
  });

  rdTest('menu do paciente exibe Meus Planos', async ({ page, goto }) => {
    await mockAuthForRole(page, 'patient');
    await page.route('**/functions/v1/get-my-plans', async (route) => {
      await fulfillJson(route, 200, edgeOk({ ...MY_PLANS_RESPONSE, state: 'no_plan', currentPlan: null }));
    });

    await goto(ROUTES.home);
    await page.getByRole('button', { name: /menu do usuario|menu do usuário/i }).click();
    await expect(page.getByRole('menuitem', { name: /Meus Planos/i })).toBeVisible();
  });

  rdTest('profissional nao ve Meus Planos no menu', async ({ page, goto }) => {
    await mockAuthForRole(page, 'professional');
    await goto(ROUTES.home);
    await page.getByRole('button', { name: /menu do usuario|menu do usuário/i }).click();
    await expect(page.getByRole('menuitem', { name: /Meus Planos/i })).toHaveCount(0);
  });
});
