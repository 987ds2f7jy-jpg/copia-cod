/**
 * teleconsulta/payment-flow.spec.ts
 *
 * TIPO: Fluxo crítico
 *
 * PROPÓSITO
 *   Cobrir a camada real de pagamento do plantão:
 *   - /pagamento/:status é rota protegida por autenticação;
 *   - sucesso, falha e pendente exibem mensagens próprias;
 *   - a tela de retorno nao exibe CTAs que possam quebrar o fluxo;
 *   - /ConsultaAgora usa a etapa atual de pagamento antes da fila.
 *
 * LIMITAÇÕES
 *   Criar cobrança real depende de E2E_ALLOW_QUEUE e de profissional em
 *   plantão no ambiente. Sem essa flag, validamos a UI estável e as rotas
 *   de retorno, sem gravar fila ou pagamento no banco.
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES, PAYMENT_STATUS_ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';
import { edgeOk, fulfillJson } from '../support/edge-mocks';

const PAYMENT_RETURN_CONTEXT_KEY = 'rd.payment.return_context.v1';

const PAYMENT_EXPECTATIONS = [
  {
    status: 'sucesso',
    route: PAYMENT_STATUS_ROUTES.sucesso,
  },
  {
    status: 'falha',
    route: PAYMENT_STATUS_ROUTES.falha,
  },
  {
    status: 'pendente',
    route: PAYMENT_STATUS_ROUTES.pendente,
  },
] as const;

async function installPaymentContext(page: import('@playwright/test').Page) {
  await page.addInitScript(({ key }) => {
    window.sessionStorage.setItem(key, JSON.stringify({
      paymentChargeId: 'payment-charge-e2e',
      successRedirectPath: '/DashboardPaciente',
      pendingRedirectPath: '/MeusPagamentos',
      failureRedirectPath: '/MeusPagamentos',
    }));
  }, { key: PAYMENT_RETURN_CONTEXT_KEY });
}

async function mockPaymentStatus(
  page: import('@playwright/test').Page,
  status: string,
  serviceReleased: boolean,
) {
  await page.route('**/functions/v1/get-payment-status', async (route) => {
    await fulfillJson(route, 200, edgeOk({
      chargeId: 'payment-charge-e2e',
      ownerType: 'queue',
      ownerId: 'queue-e2e',
      status,
      serviceReleased,
      updatedAt: '2026-07-12T12:00:00.000Z',
    }));
  });
}

rdTest.describe('pagamento retorno — sem autenticação', () => {
  for (const { status, route } of PAYMENT_EXPECTATIONS) {
    rdTest(`/pagamento/${status} redireciona para /Entrar e salva rd_login_next`, async ({
      page, goto, clearAuthState,
    }) => {
      await clearAuthState();
      await goto(route);

      await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });

      const loginNext = await page.evaluate(() =>
        window.sessionStorage.getItem('rd_login_next'),
      );
      expect(loginNext).toContain(route);
    });
  }
});

rdTest.describe('pagamento retorno — paciente autenticado', () => {
  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach((_fixtures, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  for (const { status, route } of PAYMENT_EXPECTATIONS) {
    rdTest(`/pagamento/${status} sem contexto nao confirma pagamento @critical`, async ({
      page, goto,
    }) => {
      let statusRequests = 0;
      page.on('request', (request) => {
        if (request.url().includes('/functions/v1/get-payment-status')) statusRequests += 1;
      });

      await goto(route);

      await expect(page).not.toHaveURL(/\/Entrar/);
      await expect(page.getByRole('heading', { name: 'Pagamento nao identificado' }))
        .toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/nao comprova pagamento/i)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ver Meus Pagamentos' })).toBeVisible();
      expect(statusRequests).toBe(0);
    });
  }

  rdTest('rota de sucesso mantem cobranca pendente sem liberar servico @critical', async ({
    page, goto,
  }) => {
    await installPaymentContext(page);
    await mockPaymentStatus(page, 'payment_pending', false);
    await goto(PAYMENT_STATUS_ROUTES.sucesso);

    await expect(page.getByRole('heading', { name: 'Pagamento em processamento' }))
      .toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/aguardando a confirmacao segura/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Continuar/i })).not.toBeVisible();
  });

  rdTest('pagamento pago so conclui quando backend informa servico liberado @critical', async ({
    page, goto,
  }) => {
    await installPaymentContext(page);
    await mockPaymentStatus(page, 'paid', true);
    await goto(PAYMENT_STATUS_ROUTES.sucesso);

    await expect(page.getByRole('heading', { name: 'Pagamento confirmado' }))
      .toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/servico esta liberado/i)).toBeVisible();
    await page.getByRole('button', { name: /Continuar/i }).click();

    await expect(page).toHaveURL(/\/DashboardPaciente/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });
  });

  rdTest('pagamento pago sem liberacao permanece em processamento @critical', async ({
    page, goto,
  }) => {
    await installPaymentContext(page);
    await mockPaymentStatus(page, 'paid', false);
    await goto(PAYMENT_STATUS_ROUTES.sucesso);

    await expect(page.getByRole('heading', { name: 'Pagamento confirmado' }))
      .toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/finalizando processamento/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Continuar/i })).not.toBeVisible();
  });

  rdTest('falha confirmada pelo backend nao redireciona automaticamente @critical', async ({
    page, goto,
  }) => {
    await installPaymentContext(page);
    await mockPaymentStatus(page, 'payment_failed', false);
    await goto(PAYMENT_STATUS_ROUTES.falha);

    await expect(page.getByRole('heading', { name: 'Pagamento nao concluido' }))
      .toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/pagamento\/falha/);
  });

  rdTest('status desconhecido sem contexto continua sem comprovar pagamento', async ({ page, goto }) => {
    await goto(ROUTES.pagamentoStatus('status-desconhecido-e2e'));

    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(page.getByRole('heading', { name: 'Pagamento nao identificado' }))
      .toBeVisible({ timeout: 10_000 });
  });
});

rdTest.describe('consulta-agora — etapa de pagamento do plantão', () => {
  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach((_fixtures, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('formulário usa CTA atual "Criar pagamento e entrar na fila" @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/\/Entrar/);

    await expect(page.getByRole('heading', { name: 'Consulta Agora' }))
      .toBeVisible({ timeout: 12_000 });

    const paymentCta = page.getByRole('button', { name: 'Criar pagamento e entrar na fila' });
    if (await paymentCta.count() === 0) {
      await expect(
        page.getByRole('heading', { name: /Pagamento do plantao|Voce esta na fila/i })
          .or(page.getByText(/Pagamento do plantao|Voce esta na fila/i).first()),
      ).toBeVisible({ timeout: 12_000 });
      return;
    }

    await expect(paymentCta).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar na Fila', exact: true })).not.toBeVisible();
  });

  rdTest('criar cobrança abre o PaymentStep quando ambiente permite fila @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(!process.env.E2E_ALLOW_QUEUE, 'Define E2E_ALLOW_QUEUE=true para criar fila/cobrança real.');

    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(page.getByText('Entrar na Fila de Atendimento'))
      .toBeVisible({ timeout: 12_000 });

    await page.getByText('Selecione a especialidade').click();
    await page.getByRole('option').first().click();

    const button = page.getByRole('button', { name: 'Criar pagamento e entrar na fila' });
    const canProceed = await button.isEnabled().catch(() => false);
    rdTest.skip(!canProceed, 'Requer profissional em plantão e precificação disponível.');

    await page.getByPlaceholder(/dor de cabeca|sintomas|Ex:/i).fill('Teste E2E — pagamento do plantão');
    await button.click();

    await expect(
      page.getByRole('heading', { name: 'Pagamento do plantao' })
        .or(page.getByText(/Pagamento indisponivel|A cobranca foi criada/i)),
    ).toBeVisible({ timeout: 20_000 });
  });
});
