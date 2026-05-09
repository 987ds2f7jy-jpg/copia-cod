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

const PAYMENT_EXPECTATIONS = [
  {
    status: 'sucesso',
    route: PAYMENT_STATUS_ROUTES.sucesso,
    title: 'Pagamento recebido',
    detail: /redirecionado automaticamente/i,
  },
  {
    status: 'falha',
    route: PAYMENT_STATUS_ROUTES.falha,
    title: /Pagamento n.o conclu.do/i,
    detail: /tentar novamente/i,
  },
  {
    status: 'pendente',
    route: PAYMENT_STATUS_ROUTES.pendente,
    title: 'Pagamento pendente',
    detail: /acompanhar o status/i,
  },
] as const;

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

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  for (const { status, route, title, detail } of PAYMENT_EXPECTATIONS) {
    rdTest(`/pagamento/${status} exibe mensagem de retorno automatico @critical`, async ({
      page, goto,
    }) => {
      await goto(route);

      await expect(page).not.toHaveURL(/\/Entrar/);
      await expect(page.getByRole('heading', { name: title }))
        .toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(detail)).toBeVisible();
      await expect(page.getByText(/Voc. est. sendo redirecionado/i)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ver painel' })).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Voltar ao inicio' })).not.toBeVisible();
    });
  }

  rdTest('pagamento com sucesso redireciona automaticamente para DashboardPaciente @critical', async ({
    page, goto,
  }) => {
    await goto(PAYMENT_STATUS_ROUTES.sucesso);
    await expect(page.getByRole('heading', { name: 'Pagamento recebido' }))
      .toBeVisible({ timeout: 10_000 });

    await expect(page).toHaveURL(/\/DashboardPaciente/, { timeout: 8_000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });
  });

  rdTest('pagamento com falha redireciona automaticamente sem quebrar a UI @critical', async ({
    page, goto,
  }) => {
    await goto(PAYMENT_STATUS_ROUTES.falha);
    await expect(page.getByRole('heading', { name: /Pagamento n.o conclu.do/i }))
      .toBeVisible({ timeout: 10_000 });

    await expect(page).toHaveURL(/\/DashboardPaciente/, { timeout: 8_000 });
  });

  rdTest('status desconhecido usa estado pendente como fallback', async ({ page, goto }) => {
    await goto(ROUTES.pagamentoStatus('status-desconhecido-e2e'));

    await expect(page).not.toHaveURL(/\/Entrar/);
    await expect(page.getByRole('heading', { name: 'Pagamento pendente' }))
      .toBeVisible({ timeout: 10_000 });
  });
});

rdTest.describe('consulta-agora — etapa de pagamento do plantão', () => {
  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
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
