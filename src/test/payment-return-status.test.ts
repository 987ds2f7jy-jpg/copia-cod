import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { getPaymentStatus } from '../../supabase/functions/get-payment-status/service';
import type {
  GetPaymentStatusRepository,
  PaymentChargeRecord,
  PaymentOwnerRecord,
} from '../../supabase/functions/get-payment-status/types';

const charge: PaymentChargeRecord = {
  id: '40000000-0000-4000-8000-000000000001',
  ownerType: 'appointment',
  ownerId: '30000000-0000-4000-8000-000000000001',
  status: 'payment_pending',
  updatedAt: '2026-07-12T12:00:00.000Z',
};

const owner: PaymentOwnerRecord = {
  id: charge.ownerId,
  patientId: '10000000-0000-4000-8000-000000000001',
  currentPaymentChargeId: charge.id,
  paymentStatus: 'payment_pending',
  operationalStatus: 'SOLICITADO',
  consultaId: null,
};

function makeRepository({
  role = 'patient',
  appUserId = owner.patientId,
  chargeRecord = charge,
  ownerRecord = owner,
}: {
  role?: string;
  appUserId?: string;
  chargeRecord?: PaymentChargeRecord | null;
  ownerRecord?: PaymentOwnerRecord | null;
} = {}) {
  return {
    findAppUserByAuthUserId: vi.fn().mockResolvedValue({ id: appUserId, role, isActive: true }),
    findPaymentChargeById: vi.fn().mockResolvedValue(chargeRecord),
    findPaymentOwner: vi.fn().mockResolvedValue(ownerRecord),
  } as unknown as GetPaymentStatusRepository;
}

function runStatus(repository: GetPaymentStatusRepository) {
  return getPaymentStatus({
    requestId: 'request-payment',
    input: { chargeId: charge.id },
    authenticatedUser: { authUserId: 'auth-patient', email: null },
    repository,
  });
}

describe('payment return backend status', () => {
  it('keeps a pending charge pending even when the browser route says success', async () => {
    const result = await runStatus(makeRepository());

    expect(result.status).toBe('payment_pending');
    expect(result.serviceReleased).toBe(false);
  });

  it('reports success only after paid charge, synchronized owner and consultation release', async () => {
    const result = await runStatus(makeRepository({
      chargeRecord: { ...charge, status: 'paid' },
      ownerRecord: {
        ...owner,
        paymentStatus: 'paid',
        operationalStatus: 'accepted',
        consultaId: '50000000-0000-4000-8000-000000000001',
      },
    }));

    expect(result).toMatchObject({ status: 'paid', serviceReleased: true });
  });

  it('does not report a paid appointment as complete before the consultation exists', async () => {
    const result = await runStatus(makeRepository({
      chargeRecord: { ...charge, status: 'paid' },
      ownerRecord: { ...owner, paymentStatus: 'paid' },
    }));

    expect(result).toMatchObject({ status: 'paid', serviceReleased: false });
  });

  it('forbids another patient and professional accounts', async () => {
    await expect(runStatus(makeRepository({
      appUserId: '10000000-0000-4000-8000-000000000099',
    }))).rejects.toMatchObject({ status: 403, code: 'PAYMENT_CHARGE_FORBIDDEN' });

    await expect(runStatus(makeRepository({ role: 'professional' }))).rejects.toMatchObject({
      status: 403,
      code: 'PATIENT_ROLE_REQUIRED',
    });
  });

  it('does not reveal an arbitrary missing charge', async () => {
    await expect(runStatus(makeRepository({ chargeRecord: null }))).rejects.toMatchObject({
      status: 404,
      code: 'PAYMENT_CHARGE_NOT_FOUND',
    });
  });

  it('requires local context and implements finite cancellable polling in the page', () => {
    const page = readFileSync('src/pages/PagamentoRetorno.jsx', 'utf8');

    expect(page).toContain("context?.paymentChargeId");
    expect(page).toContain('POLL_TIMEOUT_MS = 55000');
    expect(page).toContain('window.clearTimeout(timerId)');
    expect(page).toContain('serviceReleased');
    expect(page).toContain('Pagamento confirmado, finalizando processamento.');
    expect(page).not.toContain('simulatePaymentPaidRequest');
    expect(page).not.toContain('session_id');
  });
});
