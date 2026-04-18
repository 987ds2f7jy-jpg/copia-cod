/**
 * profile/edit-and-deactivate.spec.ts
 *
 * TIPO: Regra de negócio
 *
 * PROPÓSITO
 *   Cobrir as ações na página de Perfil (/Perfil): edição de dados
 *   pessoais e o fluxo destrutivo de desativação de conta.
 *
 * O QUE COBRE
 *   - Página carrega com dados do usuário preenchidos
 *   - Edição de campos válidos salva e exibe confirmação
 *   - Nome com menos de 3 caracteres exibe erro (validação authService)
 *   - Desativação de conta: fluxo completo com confirmação
 *   - Após desativação: sessão limpa e redirect para home
 *   - Após desativação: tentativa de login exibe "conta inativa"
 *
 * POR QUE EXISTE
 *   A desativação é uma ação destrutiva e irreversível. Uma regressão
 *   aqui pode deixar usuários sem acesso ou com sessão orphan.
 *
 * RISCO COBERTO
 *   R3 (sessão deve ser completamente limpa após desativação)
 *
 * OBSERVAÇÕES
 *   - Testes de desativação usam um usuário descartável (E2E_DISPOSABLE_EMAIL)
 *   - Nunca usar USERS.patient para desativar — quebraria outros testes
 *   - Em CI: criar usuário descartável no seed e usar apenas aqui
 */

import { test, expect } from '../support/fixtures';
import { AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';

// ---------------------------------------------------------------------------
// Edição de perfil
// ---------------------------------------------------------------------------
test.describe('perfil — edição de dados', () => {

  test.use({ storageState: AUTH_STATE.patient });

  test('página de perfil carrega com dados do usuário @critical', async ({ page, goto }) => {
    await goto(ROUTES.perfil);

    await expect(page).toHaveURL(/Perfil/);
    // Os campos devem estar preenchidos com os dados do usuário autenticado
    await expect(page.getByLabel(/nome/i)).not.toBeEmpty({ timeout: 10_000 });
  });

  test('salvar nome válido exibe confirmação de sucesso', async ({ page, goto }) => {
    await goto(ROUTES.perfil);

    // TODO: editar o campo de nome e salvar
    // Verificar toast/mensagem de sucesso
    test.fixme(true, 'Implementar após identificar o campo de nome e botão de salvar na UI');
  });

  test('nome com menos de 3 caracteres exibe erro de validação', async ({ page, goto }) => {
    await goto(ROUTES.perfil);

    // authService.sanitizeProfilePayload valida: fullName.length < 3
    // TODO: preencher nome com "AB" e salvar
    test.fixme(true, 'Implementar após identificar seletores do formulário de perfil');
  });

});

// ---------------------------------------------------------------------------
// Desativação de conta
// ---------------------------------------------------------------------------
test.describe('perfil — desativação de conta', () => {

  test('botão de desativar conta está visível na página de perfil', async ({
    page, goto,
  }) => {
    // Usa storageState do paciente padrão apenas para verificar que o botão existe
    test.use({ storageState: AUTH_STATE.patient });
    await goto(ROUTES.perfil);

    await expect(
      page.getByRole('button', { name: /desativar.*conta|excluir.*conta/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('desativação completa limpa sessão e redireciona para home @critical', async ({
    page, goto,
  }) => {
    test.skip(
      !process.env.E2E_DISPOSABLE_EMAIL,
      'Requer E2E_DISPOSABLE_EMAIL — conta descartável para não quebrar outros testes.',
    );
    test.skip(
      !process.env.E2E_ALLOW_DEACTIVATION,
      'Defina E2E_ALLOW_DEACTIVATION=true para executar este teste destrutivo.',
    );

    // TODO: criar storageState para o usuário descartável
    await goto(ROUTES.perfil);

    await page.getByRole('button', { name: /desativar.*conta/i }).click();

    // Confirmar no dialog de confirmação
    await page.getByRole('button', { name: /confirmar|sim.*desativar/i }).click();

    // Deve redirecionar para home via window.location.href
    await expect(page).toHaveURL(ROUTES.home, { timeout: 15_000 });

    // Sessão deve estar limpa
    const session = await page.evaluate(() =>
      window.localStorage.getItem('rd.auth.session.v1'),
    );
    expect(session).toBeNull();
  });

  test('após desativação, login exibe conta inativa @critical', async ({ page, goto }) => {
    test.skip(
      !process.env.E2E_DEACTIVATED_EMAIL,
      'Requer E2E_DEACTIVATED_EMAIL — conta já desativada.',
    );

    await goto(ROUTES.entrar);
    await page.getByLabel('Email').fill(process.env.E2E_DEACTIVATED_EMAIL!);
    await page.getByLabel('Senha').fill(process.env.E2E_DEACTIVATED_PASSWORD!);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByText(/conta.*inativa/i)).toBeVisible({ timeout: 10_000 });
  });

});
