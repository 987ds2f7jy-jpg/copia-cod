/**
 * patient/planos.spec.ts
 *
 * ROTA: /Planos — pública, sem ProtectedRoute
 *
 * SELETORES REAIS (Planos.jsx)
 *   h1 "Planos pensados para o seu cuidado contínuo"
 *   Badge "Programa de fidelidade"
 *   Tabs: TabsTrigger "Planos" | TabsTrigger "Empresas"
 *   Aba Planos: 3 PlanoCard com h3 nome + preço
 *     "Emagrecimento" R$149,90 · "Familiar" R$249,90 · "Psicologia" R$199,90
 *     Badge "Mais escolhido" → plano.destaque=true (Familiar)
 *     "Plano de fidelidade" (label abaixo de cada h3)
 *     Botão CTA: onClick={(e) => e.preventDefault()} — NÃO navega
 *   Aba Empresas: FormularioEmpresas
 *     h3 "Planos personalizados para sua empresa"
 *     id="empresa", id="responsavel", id="email", id="telefone", id="vidas", id="mensagem"
 *     button "Solicitar proposta" (disabled durante enviando)
 *     Toast title "Solicitação registrada" (setTimeout 600ms — sem envio real)
 *
 * LIMITAÇÕES
 *   Formulário de empresas é visual: não há integração real.
 *   O toast de "Solicitação registrada" é disparado após 600ms (setTimeout local).
 *   Não requer flag — o submit é simulado e seguro.
 */

import { test as rdTest, expect } from '../support/fixtures';
import { ROUTES } from '../support/constants';

// ---------------------------------------------------------------------------
// Acesso e estrutura geral
// ---------------------------------------------------------------------------
rdTest.describe('planos — acesso e estrutura', () => {

  rdTest.beforeEach(async ({ clearAuthState }) => {
    await clearAuthState();
  });

  rdTest('rota pública carrega sem login @smoke', async ({ page, goto }) => {
    await goto(ROUTES.planos);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByRole('heading', {
        name: 'Planos pensados para o seu cuidado contínuo',
      })
    ).toBeVisible({ timeout: 12_000 });
  });

  rdTest('badge "Programa de fidelidade" está visível @smoke', async ({ page, goto }) => {
    await goto(ROUTES.planos);
    await expect(page.getByText('Programa de fidelidade')).toBeVisible({ timeout: 8_000 });
  });

  rdTest('tabs "Planos" e "Empresas" existem @critical', async ({ page, goto }) => {
    await goto(ROUTES.planos);
    await expect(
      page.getByRole('heading', { name: 'Planos pensados para o seu cuidado contínuo' })
    ).toBeVisible({ timeout: 12_000 });
    await expect(page.getByRole('tab', { name: 'Planos' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Empresas' })).toBeVisible();
  });

  rdTest('aba "Planos" está ativa por padrão @critical', async ({ page, goto }) => {
    await goto(ROUTES.planos);
    await expect(
      page.getByRole('heading', { name: 'Planos pensados para o seu cuidado contínuo' })
    ).toBeVisible({ timeout: 12_000 });
    await expect(
      page.getByRole('tab', { name: 'Planos' })
    ).toHaveAttribute('aria-selected', 'true');
  });

});

// ---------------------------------------------------------------------------
// Aba Planos — 3 cards
// ---------------------------------------------------------------------------
rdTest.describe('planos — aba Planos (3 cards)', () => {

  rdTest.beforeEach(async ({ clearAuthState }) => {
    await clearAuthState();
  });

  rdTest('3 cards de plano estão presentes @critical', async ({ page, goto }) => {
    await goto(ROUTES.planos);
    await expect(
      page.getByRole('heading', { name: 'Planos pensados para o seu cuidado contínuo' })
    ).toBeVisible({ timeout: 12_000 });

    await expect(page.getByRole('heading', { name: 'Emagrecimento', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Familiar', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Psicologia', level: 3 })).toBeVisible();
  });

  rdTest('preços corretos exibidos em cada card @critical', async ({ page, goto }) => {
    await goto(ROUTES.planos);
    await expect(
      page.getByRole('heading', { name: 'Planos pensados para o seu cuidado contínuo' })
    ).toBeVisible({ timeout: 12_000 });

    // formatPreco(149.90) → "149,90" em pt-BR
    await expect(page.getByText('149,90')).toBeVisible();
    await expect(page.getByText('249,90')).toBeVisible();
    await expect(page.getByText('199,90')).toBeVisible();
  });

  rdTest('badge "Mais escolhido" aparece apenas no plano Familiar @critical', async ({ page, goto }) => {
    await goto(ROUTES.planos);
    await expect(
      page.getByRole('heading', { name: 'Planos pensados para o seu cuidado contínuo' })
    ).toBeVisible({ timeout: 12_000 });

    await expect(page.getByText('Mais escolhido')).toBeVisible();
    // Apenas um badge deve existir
    await expect(page.getByText('Mais escolhido')).toHaveCount(1);
  });

  rdTest('label "Plano de fidelidade" aparece nos 3 cards', async ({ page, goto }) => {
    await goto(ROUTES.planos);
    await expect(
      page.getByRole('heading', { name: 'Planos pensados para o seu cuidado contínuo' })
    ).toBeVisible({ timeout: 12_000 });
    // 3 cards, cada um com o label
    await expect(page.getByText('Plano de fidelidade')).toHaveCount(3);
  });

  rdTest('CTAs dos cards NÃO navegam (onClick preventDefault) @critical', async ({ page, goto }) => {
    await goto(ROUTES.planos);
    await expect(
      page.getByRole('heading', { name: 'Planos pensados para o seu cuidado contínuo' })
    ).toBeVisible({ timeout: 12_000 });

    const currentUrl = page.url();

    // Clicar nos 3 CTAs — nenhum deve navegar
    await page.getByRole('button', { name: 'Quero esse plano' }).click();
    await expect(page).toHaveURL(currentUrl);

    await page.getByRole('button', { name: 'Escolher plano familiar' }).click();
    await expect(page).toHaveURL(currentUrl);

    await page.getByRole('button', { name: 'Começar agora' }).click();
    await expect(page).toHaveURL(currentUrl);
  });

  rdTest('texto "Cobrado mensalmente · Cancele quando quiser" presente nos 3 cards', async ({ page, goto }) => {
    await goto(ROUTES.planos);
    await expect(
      page.getByRole('heading', { name: 'Planos pensados para o seu cuidado contínuo' })
    ).toBeVisible({ timeout: 12_000 });
    await expect(
      page.getByText('Cobrado mensalmente · Cancele quando quiser')
    ).toHaveCount(3);
  });

  rdTest('nota de valores ilustrativos está visível @critical', async ({ page, goto }) => {
    await goto(ROUTES.planos);
    await expect(
      page.getByRole('heading', { name: 'Planos pensados para o seu cuidado contínuo' })
    ).toBeVisible({ timeout: 12_000 });
    await expect(
      page.getByText(/valores e benefícios apresentados são ilustrativos/i)
    ).toBeVisible();
  });

});

// ---------------------------------------------------------------------------
// Aba Empresas — formulário B2B
// ---------------------------------------------------------------------------
rdTest.describe('planos — aba Empresas (formulário B2B)', () => {

  rdTest.beforeEach(async ({ clearAuthState }) => {
    await clearAuthState();
  });

  rdTest('clicar na aba Empresas exibe o formulário @critical', async ({ page, goto }) => {
    await goto(ROUTES.planos);
    await expect(
      page.getByRole('heading', { name: 'Planos pensados para o seu cuidado contínuo' })
    ).toBeVisible({ timeout: 12_000 });

    await page.getByRole('tab', { name: 'Empresas' }).click();
    await expect(
      page.getByRole('heading', { name: 'Planos personalizados para sua empresa', level: 3 })
    ).toBeVisible({ timeout: 8_000 });
  });

  rdTest('formulário exibe 6 campos obrigatórios/principais @critical', async ({ page, goto }) => {
    await goto(ROUTES.planos);
    await expect(
      page.getByRole('heading', { name: 'Planos pensados para o seu cuidado contínuo' })
    ).toBeVisible({ timeout: 12_000 });
    await page.getByRole('tab', { name: 'Empresas' }).click();

    await expect(page.locator('#empresa')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#responsavel')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#telefone')).toBeVisible();
    await expect(page.locator('#vidas')).toBeVisible();
    await expect(page.locator('#mensagem')).toBeVisible();
  });

  rdTest('botão "Solicitar proposta" existe e está habilitado @critical', async ({ page, goto }) => {
    await goto(ROUTES.planos);
    await expect(
      page.getByRole('heading', { name: 'Planos pensados para o seu cuidado contínuo' })
    ).toBeVisible({ timeout: 12_000 });
    await page.getByRole('tab', { name: 'Empresas' }).click();
    await expect(page.locator('#empresa')).toBeVisible({ timeout: 5_000 });

    await expect(
      page.getByRole('button', { name: 'Solicitar proposta' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Solicitar proposta' })
    ).toBeEnabled();
  });

  rdTest('submit exibe "Enviando..." e depois toast "Solicitação registrada" @critical', async ({ page, goto }) => {
    await goto(ROUTES.planos);
    await expect(
      page.getByRole('heading', { name: 'Planos pensados para o seu cuidado contínuo' })
    ).toBeVisible({ timeout: 12_000 });
    await page.getByRole('tab', { name: 'Empresas' }).click();
    await expect(page.locator('#empresa')).toBeVisible({ timeout: 5_000 });

    // Preencher todos os campos obrigatórios
    await page.locator('#empresa').fill('Acme Saúde E2E Ltda.');
    await page.locator('#responsavel').fill('Teste E2E Responsável');
    await page.locator('#email').fill('e2e@acme-saude-teste.com');
    await page.locator('#telefone').fill('(11) 99999-0000');
    await page.locator('#vidas').fill('50');

    await page.getByRole('button', { name: 'Solicitar proposta' }).click();

    // Feedback "Enviando..." durante o setTimeout(600ms)
    await expect(
      page.getByRole('button', { name: 'Enviando...' })
    ).toBeVisible({ timeout: 3_000 });

    // Toast "Solicitação registrada" após 600ms
    await expect(
      page.getByText('Solicitação registrada')
    ).toBeVisible({ timeout: 5_000 });
  });

  rdTest('após submit bem-sucedido o formulário é resetado @critical', async ({ page, goto }) => {
    await goto(ROUTES.planos);
    await expect(
      page.getByRole('heading', { name: 'Planos pensados para o seu cuidado contínuo' })
    ).toBeVisible({ timeout: 12_000 });
    await page.getByRole('tab', { name: 'Empresas' }).click();
    await expect(page.locator('#empresa')).toBeVisible({ timeout: 5_000 });

    await page.locator('#empresa').fill('Empresa Reset Teste E2E');
    await page.locator('#responsavel').fill('Nome Reset');
    await page.locator('#email').fill('reset@e2e.com');
    await page.locator('#telefone').fill('(11) 88888-0000');
    await page.locator('#vidas').fill('25');

    await page.getByRole('button', { name: 'Solicitar proposta' }).click();
    await expect(page.getByText('Solicitação registrada')).toBeVisible({ timeout: 5_000 });

    // Formulário resetado (INITIAL_FORM = campos vazios)
    await expect(page.locator('#empresa')).toHaveValue('');
    await expect(page.locator('#responsavel')).toHaveValue('');
  });

  rdTest('informação de segurança/confidencialidade visível', async ({ page, goto }) => {
    await goto(ROUTES.planos);
    await expect(
      page.getByRole('heading', { name: 'Planos pensados para o seu cuidado contínuo' })
    ).toBeVisible({ timeout: 12_000 });
    await page.getByRole('tab', { name: 'Empresas' }).click();
    await expect(page.locator('#empresa')).toBeVisible({ timeout: 5_000 });

    await expect(
      page.getByText('Seus dados são tratados com segurança e confidencialidade.')
    ).toBeVisible();
  });

});
