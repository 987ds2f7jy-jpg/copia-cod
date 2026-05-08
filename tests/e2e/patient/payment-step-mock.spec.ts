import { test, expect } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import {
  edgeOk,
  fulfillJson,
  mockAuthForRole,
} from '../support/edge-mocks';

async function mockConsultaAgoraPricingFlow(page) {
  await page.route('**/functions/v1/read-models', async (route) => {
    const request = route.request();
    const body = request.postDataJSON?.() || {};
    const entity = body.entity;

    if (entity === 'ProfessionalPublicProfile') {
      await fulfillJson(route, 200, edgeOk({
        records: [{
          id: 'public-professional-e2e',
          professional_profile_id: 'professional-profile-e2e',
          full_name: 'Dr. Plantao Mock',
          specialty: 'Pediatria',
          status: 'approved',
          is_on_duty: true,
        }],
      }));
      return;
    }

    if (entity === 'Queue') {
      await fulfillJson(route, 200, edgeOk({ records: [] }));
      return;
    }

    await fulfillJson(route, 200, edgeOk({ records: [] }));
  });

  await page.route('**/functions/v1/quote-service-pricing', async (route) => {
    await fulfillJson(route, 200, edgeOk({
      serviceCode: 'on_duty_pediatria',
      grossPrice: 120,
      currency: 'BRL',
    }));
  });

  await page.route('**/functions/v1/join-queue', async (route) => {
    await fulfillJson(route, 200, edgeOk({
      queueEntry: {
        id: 'queue-mock-payment-e2e',
        patient_id: 'patient-app-user-e2e',
        specialty: 'pediatria',
        symptoms: 'Teste mock sem checkout',
        status: 'waiting',
        payment_status: 'payment_pending',
        paymentStatus: 'payment_pending',
        quoted_gross_price: 120,
        current_payment_charge_id: 'charge-mock-payment-e2e',
        payment: {
          paymentChargeId: 'charge-mock-payment-e2e',
          status: 'payment_pending',
          amount: 120,
          currency: 'BRL',
          provider: 'mock',
          checkoutUrl: '',
        },
      },
    }));
  });
}

test.describe('PaymentStep em modo mock', () => {
  test('não auto-regenera cobrança sem checkoutUrl em provider mock', async ({ page, goto }) => {
    await mockAuthForRole(page, 'patient');
    await mockConsultaAgoraPricingFlow(page);

    let ensureChargeCalls = 0;
    await page.route('**/functions/v1/ensure-payment-charge', async (route) => {
      ensureChargeCalls += 1;
      await fulfillJson(route, 200, edgeOk({
        payment: {
          paymentChargeId: 'charge-mock-payment-e2e',
          status: 'payment_pending',
          amount: 120,
          currency: 'BRL',
          provider: 'mock',
          checkoutUrl: '',
        },
      }));
    });

    await goto(ROUTES.consultaAgora);
    await expect(page.getByRole('heading', { name: 'Consulta Agora' })).toBeVisible({
      timeout: 12_000,
    });

    await page.getByText('Selecione a especialidade').click();
    await page.getByRole('option', { name: /Pediatria/i }).click();
    await page.getByPlaceholder(/dor de cabeca|sintomas|Ex:/i).fill('Teste mock sem checkout');
    await page.getByRole('button', { name: 'Criar pagamento e entrar na fila' }).click();

    await expect(page.getByRole('heading', { name: 'Pagamento do plantao' })).toBeVisible({
      timeout: 10_000,
    });

    await page.waitForTimeout(1200);

    expect(ensureChargeCalls).toBe(0);
  });
});
