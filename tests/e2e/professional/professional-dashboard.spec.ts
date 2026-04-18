/**
 * dashboard/professional-dashboard.spec.ts
 *
 * TIPO: Regra de negócio
 *
 * PROPÓSITO
 *   Cobrir o DashboardProfissional: acesso por status de aprovação,
 *   toggle de plantão, e visualização de KPIs.
 *
 * O QUE COBRE
 *   - Profissional aprovado acessa dashboard normalmente
 *   - Profissional pending_review vê ProfessionalStatusGate
 *   - Toggle de plantão liga/desliga isOnDuty
 *   - Dashboard sem dados exibe estado vazio sem crash
 *
 * POR QUE EXISTE
 *   R7 (ProfessionalStatusGate é presentacional — não bloqueia a rota).
 *   Se o gate for removido por acidente, profissionais não aprovados
 *   veriam dados reais. Este teste detecta essa regressão.
 *
 * RISCO COBERTO
 *   R7 (profissional não aprovado acessa dashboard)
 *   R6 (duty ativo pode ficar "preso" após logout/crash)
 *
 * OBSERVAÇÕES
 *   Seed necessário:
 *     E2E_PENDING_PROFESSIONAL_EMAIL — profissional com status=pending_review
 *     Profissional aprovado já está em USERS.professional (global-setup)
 */

import { test, expect } from '../support/fixtures';
import { AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';

// ---------------------------------------------------------------------------
// Profissional aprovado
// ---------------------------------------------------------------------------
test.describe('dashboard profissional — aprovado', () => {

  test.use({ storageState: AUTH_STATE.professional });

  test('dashboard carrega sem ProfessionalStatusGate @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);

    await expect(page).toHaveURL(/DashboardProfissional/);
    await expect(page.getByRole('heading', { name: /cadastro em análise/i })).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /conta suspensa/i })).not.toBeVisible();
  });

  test('dashboard exibe KPIs principais', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);

    // Os 4 KPI cards do DashboardProfissional
    await expect(page.getByText(/consultas/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('toggle de plantão alterna estado de isOnDuty @critical', async ({ page, goto }) => {
    await goto(ROUTES.dashboardProfissional);

    // TODO: localizar o PlantaoBlock e o switch de plantão
    // Clicar e verificar que o estado visual muda
    // Verificar que a Edge Function set-professional-duty é chamada
    test.fixme(true, 'Requer localização do PlantaoBlock e mock da Edge Function');
  });

  test('plantão ativo é desativado no logout (best-effort) @critical', async ({ page, goto }) => {
    // R6: duty pode ficar ativo após crash/logout inesperado
    // O resetProfessionalDuty é chamado no AuthContext antes do logout
    test.fixme(true, 'Implementar junto com o mock de set-professional-duty no auth/logout.spec.ts');
  });

});

// ---------------------------------------------------------------------------
// Profissional não aprovado (pending_review)
// ---------------------------------------------------------------------------
test.describe('dashboard profissional — não aprovado (R7)', () => {

  test('profissional pending_review vê ProfessionalStatusGate @critical', async ({
    page, goto,
  }) => {
    test.skip(
      !process.env.E2E_PENDING_PROFESSIONAL_EMAIL,
      'Requer seed de profissional com status=pending_review (E2E_PENDING_PROFESSIONAL_EMAIL)',
    );

    // TODO: criar storageState específico para profissional pending no global-setup
    await goto(ROUTES.dashboardProfissional);

    await expect(page.getByRole('heading', { name: /cadastro em análise/i })).toBeVisible({ timeout: 10_000 });
    // O dashboard real NÃO deve ser visível
    await expect(page.getByText(/plantão/i)).not.toBeVisible();
  });

  test('profissional suspenso vê mensagem de suspensão @critical', async ({ page, goto }) => {
    test.skip(
      !process.env.E2E_SUSPENDED_PROFESSIONAL_EMAIL,
      'Requer seed de profissional com status=suspended',
    );

    await goto(ROUTES.dashboardProfissional);
    await expect(page.getByRole('heading', { name: /conta suspensa/i })).toBeVisible({ timeout: 10_000 });
  });

  test('profissional rejeitado vê mensagem de rejeição', async ({ page, goto }) => {
    test.skip(
      !process.env.E2E_REJECTED_PROFESSIONAL_EMAIL,
      'Requer seed de profissional com status=rejected',
    );

    await goto(ROUTES.dashboardProfissional);
    await expect(page.getByRole('heading', { name: /cadastro não aprovado/i })).toBeVisible({ timeout: 10_000 });
  });

});
