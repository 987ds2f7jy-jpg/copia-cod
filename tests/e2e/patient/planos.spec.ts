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

  rdTest('CTAs dos cards sao visuais e nao navegam enquanto nao ha checkout real', async ({
    page,
    goto,
  }) => {
    await openPlanos(goto, page);
    const currentUrl = page.url();

    await page.getByRole('button', { name: 'Quero esse plano' }).click();
    await expect(page).toHaveURL(currentUrl);

    await page.getByRole('button', { name: 'Escolher plano familiar' }).click();
    await expect(page).toHaveURL(currentUrl);

    await page.getByRole('button', { name: /come.ar agora/i }).click();
    await expect(page).toHaveURL(currentUrl);
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
