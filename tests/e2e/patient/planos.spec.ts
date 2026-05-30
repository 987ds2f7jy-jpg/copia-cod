/**
 * patient/planos.spec.ts
 *
 * ROTA: /Planos
 *
 * A pagina e publica, mas fica neste bloco junto das demais jornadas de
 * paciente porque seus CTAs e planos pertencem ao funil de contratacao do app.
 */

import { test as rdTest, expect } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import {
  edgeOk,
  fulfillJson,
  mockAuthForRole,
} from '../support/edge-mocks';

const PLANOS_HEADING = /Planos pensados para o seu cuidado/i;

async function openPlanos(goto: (route: string) => Promise<void>, page: import('@playwright/test').Page) {
  await goto(ROUTES.planos);
  await expect(page).not.toHaveURL(/\/Entrar/);
  await expect(page.getByRole('heading', { name: PLANOS_HEADING })).toBeVisible({
    timeout: 12_000,
  });
}

rdTest.describe('planos - rota publica e planos individuais', () => {
  rdTest.beforeEach(async ({ clearAuthState }) => {
    await clearAuthState();
  });

  rdTest('rota publica carrega sem login e exibe abas principais @critical', async ({
    page,
    goto,
  }) => {
    await openPlanos(goto, page);

    await expect(page.getByText('Programa de fidelidade')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Planos' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('tab', { name: 'Empresas' })).toBeVisible();
  });

  rdTest('aba Planos exibe os tres produtos com precos e destaque correto @critical', async ({
    page,
    goto,
  }) => {
    await openPlanos(goto, page);

    for (const name of ['Emagrecimento', 'Familiar', 'Psicologia']) {
      await expect(page.getByRole('heading', { name, level: 3 })).toBeVisible();
    }

    for (const price of ['149,90', '249,90', '199,90']) {
      await expect(page.getByText(price)).toBeVisible();
    }

    await expect(page.getByText('Mais escolhido')).toHaveCount(1);
    await expect(page.getByText('Plano de fidelidade')).toHaveCount(3);
  });

  rdTest('CTA de plano exige login antes de iniciar checkout', async ({
    page,
    goto,
  }) => {
    await openPlanos(goto, page);
    await page.getByRole('button', { name: 'Quero esse plano' }).click();
    await expect(page).toHaveURL(/\/Entrar/);
  });
});

rdTest.describe('planos - checkout autenticado', () => {
  rdTest('envia somente plan_code ao backend e redireciona para checkout', async ({
    page,
    goto,
  }) => {
    let payload: Record<string, unknown> | null = null;
    const checkoutUrl = 'https://checkout.rapidodoutor.test/plans/family';

    await mockAuthForRole(page, 'patient');
    await page.route('**/functions/v1/create-plan-checkout', async (route) => {
      payload = route.request().postDataJSON();
      await fulfillJson(route, 200, edgeOk({
        checkoutUrl,
        order: {
          id: 'order-family-e2e',
          planCode: 'family',
          amount: 249.9,
          currency: 'BRL',
          status: 'pending_payment',
          paymentStatus: 'payment_pending',
          currentPaymentChargeId: 'charge-family-e2e',
        },
        payment: {
          paymentChargeId: 'charge-family-e2e',
          provider: 'stripe',
          status: 'payment_pending',
          amount: 249.9,
          currency: 'BRL',
          checkoutUrl,
        },
      }));
    });
    await page.route('https://checkout.rapidodoutor.test/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body><h1>Checkout E2E</h1></body></html>',
      });
    });

    await openPlanos(goto, page);
    await page.getByRole('button', { name: 'Escolher plano familiar' }).click();

    await expect.poll(() => payload?.plan_code).toBe('family');
    await expect(page).toHaveURL(checkoutUrl);
  });
});

rdTest.describe('planos - formulario empresas', () => {
  rdTest.beforeEach(async ({ clearAuthState }) => {
    await clearAuthState();
  });

  rdTest('aba Empresas exibe formulario comercial com campos acessiveis @critical', async ({
    page,
    goto,
  }) => {
    await openPlanos(goto, page);
    await page.getByRole('tab', { name: 'Empresas' }).click();

    await expect(
      page.getByRole('heading', { name: /Planos personalizados para sua empresa/i }),
    ).toBeVisible({ timeout: 8_000 });

    await expect(page.getByLabel(/nome da empresa/i)).toBeVisible();
    await expect(page.getByLabel(/nome do respons.vel/i)).toBeVisible();
    await expect(page.getByLabel(/e-mail corporativo/i)).toBeVisible();
    await expect(page.getByLabel(/telefone/i)).toBeVisible();
    await expect(page.getByLabel(/quantidade estimada/i)).toBeVisible();
    await expect(page.getByLabel(/mensagem/i)).toBeVisible();
    await expect(page.getByText(/seguran.a e confidencialidade/i)).toBeVisible();
  });

  rdTest('submit simulado mostra feedback e reseta campos sem chamar backend @critical', async ({
    page,
    goto,
  }) => {
    await openPlanos(goto, page);
    await page.getByRole('tab', { name: 'Empresas' }).click();

    const empresa = page.getByLabel(/nome da empresa/i);
    const responsavel = page.getByLabel(/nome do respons.vel/i);

    await empresa.fill('Acme Saude E2E Ltda.');
    await responsavel.fill('Responsavel E2E');
    await page.getByLabel(/e-mail corporativo/i).fill('e2e@acme.example');
    await page.getByLabel(/telefone/i).fill('(11) 99999-0000');
    await page.getByLabel(/quantidade estimada/i).fill('50');
    await page.getByLabel(/mensagem/i).fill('Cobertura E2E de formulario visual.');

    await page.getByRole('button', { name: 'Solicitar proposta' }).click();

    await expect(page.getByRole('button', { name: 'Enviando...' })).toBeVisible({
      timeout: 2_000,
    });
    await expect(page.getByText(/Solicita.*registrada/i).first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(empresa).toHaveValue('');
    await expect(responsavel).toHaveValue('');
  });
});
