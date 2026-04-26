/**
 * profile/edit-and-deactivate.spec.ts
 *
 * TIPO: Regra de negócio
 *
 * FLUXO COBERTO: /Perfil (Perfil.jsx) — edição de perfil e desativação de conta
 *
 * SELETORES BASEADOS NO HTML REAL (Perfil.jsx)
 *
 *   Cabeçalho:
 *     h1 "Meu perfil"                        → linha ~107
 *     p  "Gerencie suas informacoes pessoais." (sem acento)
 *     CardTitle {user.full_name}
 *     p  {user.email}
 *
 *   Campos de formulário (ids reais):
 *     id="phone"       → Label "Telefone"
 *     id="cpf"         → Label "CPF"
 *     id="birth_date"  → Label "Data de nascimento"
 *     id="address"     → Label "Endereco" (sem acento)
 *     id="city"        → Label "Cidade"
 *     id="state"       → Label "Estado"
 *
 *   Botão de salvar:
 *     Texto "Salvar alteracoes" (sem acento) → pending=false, saved=false
 *     Texto "Salvo!"                          → onSuccess (3s)
 *
 *   Zona de cuidado:
 *     h3 "Zona de cuidado"
 *     p  "A desativacao faz soft-delete..." (sem acento)
 *     button/trigger "Desativar conta"    → abre AlertDialog
 *
 *   AlertDialog de confirmação:
 *     AlertDialogTitle "Desativar sua conta?"
 *     AlertDialogDescription "...sera marcada como inativa..."
 *     button "Cancelar"
 *     button "Sim, desativar minha conta"  → handleDeactivateAccount()
 *
 * NOTA SOBRE MeuPerfil (profissional)
 *   O DashboardProfissional tem aba "Meu Perfil" com MeuPerfil.jsx.
 *   Esse componente tem botão "Salvar Alterações" (com acento) e campos
 *   diferentes. Testado em professional-dashboard.spec.ts como parte do dashboard.
 *
 * RISCO COBERTO
 *   R3  — sessão limpa após desativação
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';
import {
  waitForPerfilPage,
  fillPerfilField,
  savePerfilAndWait,
} from '../support/page-helpers';

function ensurePatientAuth(testInfo: { skip: (condition: boolean, reason: string) => void }) {
  skipIfNoAuth(testInfo, 'patient');
}

// ---------------------------------------------------------------------------
// Estrutura e acesso
// ---------------------------------------------------------------------------
rdTest.describe('perfil — estrutura', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest('sem sessão redireciona para /Entrar @critical', async ({
    page, goto, clearAuthState,
  }) => {
    await clearAuthState();
    await goto(ROUTES.perfil);
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

rdTest('carrega com dados do usuário preenchidos @critical', async ({ page, goto }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.perfil);
    await waitForPerfilPage(page);

    // h1 da página
    await expect(page.getByRole('heading', { name: 'Meu perfil' })).toBeVisible();
    await expect(page.getByText('Gerencie suas informacoes pessoais.')).toBeVisible();

    // Card do usuário mostra nome e email
    // CardTitle = user.full_name
    const card = page.locator('[class*="CardTitle"]').or(
      page.locator('.font-semibold').filter({ hasText: /\w{2,}/ })
    );
    await expect(card.first()).toBeVisible({ timeout: 8_000 });
  });

rdTest('todos os campos do formulário estão presentes @critical', async ({ page, goto }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.perfil);
    await waitForPerfilPage(page);

    // Campos por id — definidos no HTML real
    await expect(page.locator('#phone')).toBeVisible();
    await expect(page.locator('#cpf')).toBeVisible();
    await expect(page.locator('#birth_date')).toBeVisible();
    await expect(page.locator('#address')).toBeVisible();
    await expect(page.locator('#city')).toBeVisible();
    await expect(page.locator('#state')).toBeVisible();
  });

rdTest('botão de salvar está habilitado @critical', async ({ page, goto }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.perfil);
    await waitForPerfilPage(page);

    await expect(
      page.getByRole('button', { name: /salvar alteracoes/i })
    ).toBeEnabled();
  });

rdTest('zona de cuidado e botão de desativar conta estão visíveis', async ({
    page, goto,
  }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.perfil);
    await waitForPerfilPage(page);

    await expect(page.getByText('Zona de cuidado')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /desativar conta/i })
    ).toBeVisible();
  });

});

// ---------------------------------------------------------------------------
// Edição de campos
// ---------------------------------------------------------------------------
rdTest.describe('perfil — edição de campos', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

rdTest('alterar telefone e salvar exibe "Salvo!" @critical', async ({ page, goto }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.perfil);
    await waitForPerfilPage(page);

    await fillPerfilField(page, 'phone', '(11) 98888-7777');
    await savePerfilAndWait(page);

    // Após 3s o botão volta ao texto original — não é necessário aguardar isso
    // O que importa é que "Salvo!" apareceu (confirma onSuccess)
  });

rdTest('alterar cidade e salvar exibe "Salvo!"', async ({ page, goto }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.perfil);
    await waitForPerfilPage(page);

    await fillPerfilField(page, 'city', 'São Paulo');
    await savePerfilAndWait(page);
  });

rdTest('estado é convertido para maiúsculo automaticamente', async ({ page, goto }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.perfil);
    await waitForPerfilPage(page);

    // Perfil.jsx: onChange state → value.toUpperCase()
    const stateInput = page.locator('#state');
    await stateInput.clear();
    await stateInput.fill('sp');

    const value = await stateInput.inputValue();
    expect(value).toBe('SP');
  });

rdTest('salvar sem alterações não exibe erro', async ({ page, goto }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.perfil);
    await waitForPerfilPage(page);

    // authService.updateUser com payload vazio → chama refreshUser()
    await page.getByRole('button', { name: /salvar alteracoes/i }).click();

    // Não deve aparecer nenhuma mensagem de erro
    await expect(
      page.locator('[class*="red-50"]').or(page.locator('[class*="border-red"]'))
    ).not.toBeVisible({ timeout: 5_000 });
  });

});

// ---------------------------------------------------------------------------
// AlertDialog de desativação
// ---------------------------------------------------------------------------
rdTest.describe('perfil — AlertDialog de desativação', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

rdTest('clicar em "Desativar conta" abre o AlertDialog @critical', async ({
    page, goto,
  }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.perfil);
    await waitForPerfilPage(page);

    await page.getByRole('button', { name: /desativar conta/i }).click();

    // AlertDialogTitle "Desativar sua conta?"
    await expect(
      page.getByRole('alertdialog')
    ).toBeVisible({ timeout: 5_000 });

    await expect(
      page.getByRole('heading', { name: 'Desativar sua conta?' })
    ).toBeVisible();

    await expect(page.getByText(/sera marcada como inativa/i)).toBeVisible();
  });

rdTest('"Cancelar" no AlertDialog fecha sem desativar @critical', async ({ page, goto }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.perfil);
    await waitForPerfilPage(page);

    await page.getByRole('button', { name: /desativar conta/i }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Cancelar' }).click();

    // Dialog fecha
    await expect(page.getByRole('alertdialog')).not.toBeVisible();

    // Ainda está na página de perfil — sessão preservada
    await expect(page).toHaveURL(/Perfil/);
    await expect(page.getByRole('heading', { name: 'Meu perfil' })).toBeVisible();
  });

rdTest('botão de confirmação "Sim, desativar minha conta" está presente', async ({
    page, goto,
  }, testInfo) => {
    ensurePatientAuth(testInfo);
    await goto(ROUTES.perfil);
    await waitForPerfilPage(page);

    await page.getByRole('button', { name: /desativar conta/i }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5_000 });

    await expect(
      page.getByRole('button', { name: 'Sim, desativar minha conta' })
    ).toBeVisible();
  });

});

// ---------------------------------------------------------------------------
// Desativação real — usa conta descartável (destrutivo)
// ---------------------------------------------------------------------------
rdTest.describe('perfil — desativação de conta (requer conta descartável)', () => {

  rdTest('desativação limpa sessão e redireciona para home @critical', async ({
    page, goto, clearAuthState,
  }) => {
    rdTest.skip(
      !process.env.E2E_DISPOSABLE_EMAIL,
      'Define E2E_DISPOSABLE_EMAIL — conta descartável para não afetar outros testes.',
    );
    rdTest.skip(
      !process.env.E2E_ALLOW_DEACTIVATION,
      'Define E2E_ALLOW_DEACTIVATION=true para executar este teste destrutivo.',
    );

    // Login com conta descartável
    await clearAuthState();
    await goto(ROUTES.entrar);
    await page.getByLabel('Email').fill(process.env.E2E_DISPOSABLE_EMAIL!);
    await page.getByLabel('Senha').fill(process.env.E2E_DISPOSABLE_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/Dashboard/, { timeout: 20_000 });

    await goto(ROUTES.perfil);
    await waitForPerfilPage(page);

    // Confirmar desativação
    await page.getByRole('button', { name: /desativar conta/i }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Sim, desativar minha conta' }).click();

    // AuthContext.deactivateAccount() → clearClientState() → window.location.href = '/'
    await expect(page).toHaveURL('/', { timeout: 15_000 });

    // Sessão deve ter sido removida
    const session = await page.evaluate(() =>
      window.localStorage.getItem('rd.auth.session.v1'),
    );
    expect(session).toBeNull();
  });

  rdTest('após desativação, login exibe conta inativa @critical', async ({
    page, goto, clearAuthState,
  }) => {
    rdTest.skip(
      !process.env.E2E_DEACTIVATED_EMAIL,
      'Define E2E_DEACTIVATED_EMAIL — conta já desativada no banco.',
    );

    await clearAuthState();
    await goto(ROUTES.entrar);
    await page.getByLabel('Email').fill(process.env.E2E_DEACTIVATED_EMAIL!);
    await page.getByLabel('Senha').fill(process.env.E2E_DEACTIVATED_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Entrar' }).click();

    // authService: AppError ACCOUNT_INACTIVE → "Sua conta esta inativa"
    await expect(page.getByText(/conta.*inativa|inativa/i)).toBeVisible({ timeout: 12_000 });
    await expect(page).toHaveURL(/Entrar/);
  });

});
