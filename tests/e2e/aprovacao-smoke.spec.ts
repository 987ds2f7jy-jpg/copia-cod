/**
 * admin/aprovacao-smoke.spec.ts
 *
 * TIPO: Smoke + Controle de acesso
 *
 * PROPÓSITO
 *   Smoke básico da área administrativa. Não implementa testes profundos
 *   porque não há credencial admin disponível no ambiente atual.
 *
 * O que este arquivo cobre:
 *   1. Controle de acesso (sem auth, paciente, profissional) — SEM credencial admin
 *   2. Estrutura da página de bloqueio para não-admin
 *   3. Smoke de navegação para a rota (não crasha, exibe algo)
 *   4. Documentação clara do que está pendente por falta de credencial admin
 *
 * O aprovacao.spec.ts existente já cobre:
 *   ✓ sem sessão → /Entrar
 *   ✓ paciente → "Acesso Restrito"
 *   ✓ profissional → "Acesso Restrito"
 *   ✓ admin: estrutura h1, 5 filtros, estado vazio (mas todos com skip por falta de auth)
 *
 * Este arquivo NÃO duplica o existente — adiciona:
 *   → Verificação que a tela de bloqueio é completa e navegável
 *   → Smoke sem login (rota existe, retorna algo)
 *   → Guards documentados como testes passando (não como skip)
 *   → Skips explícitos e descritivos para tudo que requer admin
 *
 * SELETORES REAIS (AdminAprovacao.jsx — guard de não-admin)
 *   h2 "Acesso Restrito"
 *   p  "Esta pagina e exclusiva para administradores." (sem acento)
 *   button "Voltar" → navigate(-1)
 *   ShieldX icon (decorativo — não testável por role)
 *
 * PENDÊNCIAS (aguardando credencial admin)
 *   - Verificar lista de profissionais pendentes
 *   - Testar ação de aprovar (E2E_ALLOW_ADMIN_ACTIONS)
 *   - Testar ação de rejeitar com motivo
 *   - Testar ação de suspender
 *   - Testar busca por nome
 *   - Testar paginação se existir
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';

// ---------------------------------------------------------------------------
// Smoke sem autenticação — rota existe e redireciona corretamente
// ---------------------------------------------------------------------------
rdTest.describe('admin-smoke — sem autenticação', () => {

  rdTest('rota /AdminAprovacao redireciona para /Entrar sem sessão @smoke', async ({
    page, goto, clearAuthState,
  }) => {
    await clearAuthState();
    await goto(ROUTES.adminAprovacao);
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

  rdTest('rd_login_next salvo ao redirecionar para /Entrar @smoke', async ({
    page, goto, clearAuthState,
  }) => {
    await clearAuthState();
    await goto(ROUTES.adminAprovacao);
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });

    const next = await page.evaluate(() =>
      window.sessionStorage.getItem('rd_login_next'),
    );
    expect(next).toContain('AdminAprovacao');
  });

});

// ---------------------------------------------------------------------------
// Controle de acesso — paciente vê "Acesso Restrito"
// ---------------------------------------------------------------------------
rdTest.describe('admin-smoke — paciente bloqueado', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('paciente vê "Acesso Restrito" — texto completo @critical', async ({ page, goto }) => {
    await goto(ROUTES.adminAprovacao);

    await expect(
      page.getByRole('heading', { name: 'Acesso Restrito' })
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByText('Esta pagina e exclusiva para administradores.')
    ).toBeVisible();
  });

  rdTest('tela de bloqueio exibe botão "Voltar" funcional @critical', async ({ page, goto }) => {
    await goto(ROUTES.adminAprovacao);
    await expect(
      page.getByRole('heading', { name: 'Acesso Restrito' })
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole('button', { name: 'Voltar' })).toBeVisible();
    await page.getByRole('button', { name: 'Voltar' }).click();

    // navigate(-1) — saiu da tela de acesso restrito
    await expect(
      page.getByRole('heading', { name: 'Acesso Restrito' })
    ).not.toBeVisible({ timeout: 5_000 });
  });

  rdTest('URL permanece /AdminAprovacao — não há redirect automático @critical', async ({ page, goto }) => {
    await goto(ROUTES.adminAprovacao);
    await expect(
      page.getByRole('heading', { name: 'Acesso Restrito' })
    ).toBeVisible({ timeout: 10_000 });
    // ProtectedRoute renderiza bloqueio inline — URL não muda
    await expect(page).toHaveURL(/AdminAprovacao/);
  });

  rdTest('KPIs e lista de profissionais NÃO aparecem para paciente', async ({ page, goto }) => {
    await goto(ROUTES.adminAprovacao);
    await expect(
      page.getByRole('heading', { name: 'Acesso Restrito' })
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByRole('heading', { name: 'Aprovacao de Profissionais' })
    ).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Pendentes' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Aprovar' })).not.toBeVisible();
  });

});

// ---------------------------------------------------------------------------
// Controle de acesso — profissional vê "Acesso Restrito"
// ---------------------------------------------------------------------------
rdTest.describe('admin-smoke — profissional bloqueado', () => {

  rdTest.use({ storageState: AUTH_STATE.professional });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'professional');
  });

  rdTest('profissional vê "Acesso Restrito" @critical', async ({ page, goto }) => {
    await goto(ROUTES.adminAprovacao);
    await expect(
      page.getByRole('heading', { name: 'Acesso Restrito' })
    ).toBeVisible({ timeout: 10_000 });
  });

  rdTest('profissional: tela de bloqueio tem botão Voltar @critical', async ({ page, goto }) => {
    await goto(ROUTES.adminAprovacao);
    await expect(
      page.getByRole('heading', { name: 'Acesso Restrito' })
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Voltar' })).toBeVisible();
  });

});

// ---------------------------------------------------------------------------
// Pendências documentadas — testes que requerem credencial admin
// ---------------------------------------------------------------------------
rdTest.describe('admin-smoke — testes pendentes por falta de credencial admin', () => {

  rdTest('smoke: admin acessa /AdminAprovacao @smoke', async ({ page, goto }) => {
    rdTest.skip(
      !process.env.E2E_ADMIN_EMAIL,
      [
        'Credencial admin não configurada.',
        'Para habilitar: defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD no .env.e2e',
        'e rode o global-setup para gerar .auth/admin.json.',
      ].join(' '),
    );

    rdTest.use({ storageState: AUTH_STATE.admin });

    await goto(ROUTES.adminAprovacao);
    await expect(page).not.toHaveURL(/\/Entrar/);

    await expect(
      page.getByRole('heading', { name: 'Aprovacao de Profissionais' })
    ).toBeVisible({ timeout: 15_000 });
  });

  rdTest('admin: filtros Pendentes/Aprovados/Rejeitados presentes @smoke', async () => {
    rdTest.skip(
      true,
      [
        'Aguardando credencial admin (E2E_ADMIN_EMAIL).',
        'Implementado em admin/aprovacao.spec.ts — habilitará automaticamente',
        'quando o storageState de admin for gerado pelo global-setup.',
      ].join(' '),
    );
  });

  rdTest('admin: ação de aprovar profissional pendente', async () => {
    rdTest.skip(
      true,
      [
        'Aguardando credencial admin + E2E_ALLOW_ADMIN_ACTIONS + E2E_PENDING_PROFESSIONAL_PUBLIC_ID.',
        'Implementado em admin/aprovacao.spec.ts.',
      ].join(' '),
    );
  });

});
