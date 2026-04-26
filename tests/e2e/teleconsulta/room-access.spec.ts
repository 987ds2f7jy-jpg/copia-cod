/**
 * teleconsulta/room-access.spec.ts
 *
 * TIPO: Fluxo crítico
 *
 * FLUXO: /consulta/:id — sala de teleconsulta
 *
 * SELETORES BASEADOS NO HTML REAL (Teleconsulta.jsx)
 *   Estados da sala (fundo bg-gray-900 = dark):
 *     Carregando: Loader2 animando
 *     Consulta não encontrada: p "Consulta nao encontrada" + button "Voltar"
 *     Acesso restrito:   h2 "Acesso restrito" (minúsculo) + p "Apenas paciente e profissional..."
 *     Consulta finalizada: h2 "Consulta encerrada" + p "Duracao: X min"
 *     Aguardando:        div "Aguardando o profissional iniciar a sala segura..."
 *     Em atendimento:    Badge animado "Em andamento"
 *
 *   Banner de retomada (Layout.jsx):
 *     "Voce tem uma consulta em andamento." (sem acento)
 *     button "Retomar" ou "Voltar para consulta"
 *
 * MOCK
 *   A Edge Function zoom-token é interceptada para evitar dependência do Zoom SDK
 *   (que não funciona em CI sem WebRTC). O restante do fluxo é testado normalmente.
 *
 * LIMITAÇÕES
 *   - Estados de sala ativa requerem consulta real com status específico no banco
 *   - Prontuário, chat e avaliação pós-consulta requerem sala ativa
 *   - O aceite do profissional e o fluxo WebRTC não são testáveis via E2E simples
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';
import { type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Mock da Edge Function zoom-token (evita dependência WebRTC em CI)
// ---------------------------------------------------------------------------
async function mockZoomToken(page: Page) {
  await page.route('**/functions/v1/zoom-token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          signature:    'mock-zoom-sig-e2e',
          sessionName:  'consulta-e2e-sala',
          sessionKey:   'mock-key-e2e',
          userIdentity: 'pt-mock-e2e',
          userName:     'Paciente E2E',
        },
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Sem autenticação
// ---------------------------------------------------------------------------
rdTest.describe('teleconsulta — sem autenticação', () => {

  rdTest('rota /consulta/:id redireciona para /Entrar sem sessão @critical', async ({
    page, goto, clearAuthState,
  }) => {
    await clearAuthState();
    await goto(ROUTES.consultaRoom('qualquer-id-e2e'));
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

});

// ---------------------------------------------------------------------------
// Paciente autenticado — estados da sala
// ---------------------------------------------------------------------------
rdTest.describe('teleconsulta — paciente (estados)', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({ page }, testInfo) => {
    void page;
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('ID inexistente exibe "Consulta nao encontrada" e botão Voltar @critical', async ({
    page, goto,
  }) => {
    await mockZoomToken(page);
    await goto(ROUTES.consultaRoom('id-invalido-e2e-test-12345'));

    // Não redireciona para /Entrar (autenticado)
    await expect(page).not.toHaveURL(/\/Entrar/);

    // Teleconsulta.jsx: p sem acento "Consulta nao encontrada"
    await expect(
      page.getByText('Consulta nao encontrada')
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole('button', { name: 'Voltar' })).toBeVisible();
  });

  rdTest('botão Voltar na tela de erro navega para trás @critical', async ({ page, goto }) => {
    await mockZoomToken(page);
    await goto(ROUTES.consultaRoom('id-invalido-e2e-voltar'));

    await expect(
      page.getByText('Consulta nao encontrada')
    ).toBeVisible({ timeout: 15_000 });

    // Navegar para trás (navigate(-1)) — a página anterior pode ser qualquer coisa
    // O que importa é que a tela de erro sumiu
    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(
      page.getByText('Consulta nao encontrada')
    ).not.toBeVisible({ timeout: 5_000 });
  });

  rdTest('consulta de outro usuário exibe "Acesso restrito" @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(
      !process.env.E2E_CONSULTA_OUTRO_USUARIO_ID,
      'Define E2E_CONSULTA_OUTRO_USUARIO_ID com ID de consulta de outro usuário.',
    );

    await mockZoomToken(page);
    await goto(ROUTES.consultaRoom(process.env.E2E_CONSULTA_OUTRO_USUARIO_ID!));

    // h2 minúsculo (Teleconsulta.jsx linha ~417)
    await expect(
      page.getByRole('heading', { name: 'Acesso restrito' })
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.getByText(/apenas paciente e profissional vinculados/i)
    ).toBeVisible();
  });

  rdTest('consulta com status "finalizada" exibe "Consulta encerrada" @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(
      !process.env.E2E_CONSULTA_FINALIZADA_ID,
      'Define E2E_CONSULTA_FINALIZADA_ID com ID de consulta finalizada.',
    );

    await goto(ROUTES.consultaRoom(process.env.E2E_CONSULTA_FINALIZADA_ID!));

    // h2 sem acento (Teleconsulta.jsx linha ~438)
    await expect(
      page.getByRole('heading', { name: 'Consulta encerrada' })
    ).toBeVisible({ timeout: 15_000 });

    // Duração mostrada (pode ser "-" se não registrada)
    await expect(page.getByText(/duracao:/i)).toBeVisible();
  });

  rdTest('consulta "aguardando" exibe mensagem de espera pelo profissional @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(
      !process.env.E2E_CONSULTA_AGUARDANDO_ID,
      'Define E2E_CONSULTA_AGUARDANDO_ID.',
    );

    await mockZoomToken(page);
    await goto(ROUTES.consultaRoom(process.env.E2E_CONSULTA_AGUARDANDO_ID!));

    // Paciente vê mensagem de aguardar o profissional
    await expect(
      page.getByText(/aguardando o profissional iniciar a sala/i)
    ).toBeVisible({ timeout: 15_000 });
  });

});

// ---------------------------------------------------------------------------
// Banner de retomada (Layout)
// ---------------------------------------------------------------------------
rdTest.describe('teleconsulta — banner de retomada', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({ page }, testInfo) => {
    void page;
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('banner aparece na home quando há consulta em andamento @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(
      !process.env.E2E_CONSULTA_EM_ATENDIMENTO_ID,
      'Define E2E_CONSULTA_EM_ATENDIMENTO_ID com ID de consulta em andamento.',
    );

    await goto(ROUTES.home);

    // Layout.jsx: "Voce tem uma consulta em andamento." (sem acento)
    await expect(
      page.getByText(/consulta em andamento|retomar/i)
    ).toBeVisible({ timeout: 15_000 });
  });

  rdTest('clicar no banner de retomada navega para a sala @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(
      !process.env.E2E_CONSULTA_EM_ATENDIMENTO_ID,
      'Define E2E_CONSULTA_EM_ATENDIMENTO_ID.',
    );

    await goto(ROUTES.home);
    await expect(
      page.getByText(/consulta em andamento|retomar/i)
    ).toBeVisible({ timeout: 15_000 });

    // Botão de retomar navega para /consulta/:id
    await page.getByRole('button', { name: /retomar|entrar/i }).click();
    await expect(page).toHaveURL(/\/consulta\//);
  });

});

// ---------------------------------------------------------------------------
// Profissional — estados na sala
// ---------------------------------------------------------------------------
rdTest.describe('teleconsulta — profissional', () => {

  rdTest.use({ storageState: AUTH_STATE.professional });

  rdTest.beforeEach(async ({ page }, testInfo) => {
    void page;
    skipIfNoAuth(testInfo, 'professional');
  });

  rdTest('profissional acessa sala de consulta aguardando @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(
      !process.env.E2E_CONSULTA_AGUARDANDO_ID,
      'Define E2E_CONSULTA_AGUARDANDO_ID.',
    );

    await mockZoomToken(page);
    await goto(ROUTES.consultaRoom(process.env.E2E_CONSULTA_AGUARDANDO_ID!));

    // Profissional inicia automaticamente ou vê estado de inicialização
    // Teleconsulta.jsx: "Preparando a sala segura..." ou "Inicializando..."
    await expect(
      page.getByText(/preparando a sala|inicializando a sessao|aguardando/i)
        .or(page.getByRole('heading', { name: 'Consulta encerrada' }))
    ).toBeVisible({ timeout: 15_000 });
  });

  rdTest('ID inexistente também exibe erro para profissional', async ({ page, goto }) => {
    await mockZoomToken(page);
    await goto(ROUTES.consultaRoom('id-invalido-prof-e2e'));

    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(
      page.getByText('Consulta nao encontrada')
    ).toBeVisible({ timeout: 15_000 });
  });

});

// ---------------------------------------------------------------------------
// Payment — documentação de ausência
// ---------------------------------------------------------------------------
rdTest.describe('payment — cobertura pendente', () => {

  rdTest('fluxo de pagamento da teleconsulta precisa de cobertura real @critical', async () => {
    rdTest.fixme(
      true,
      'O frontend já possui PaymentStep e retorno /pagamento/:status; este caso precisa ser reescrito para validar checkout real em vez de documentar ausência.'
    );
  });

});
