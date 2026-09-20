import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { notifyInternalBestEffort } from '../../supabase/functions/_shared/notifications/notify-best-effort.ts';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('internal notifications Phase 1', () => {
  it('keeps notification failures from breaking a confirmed domain operation', async () => {
    const error = new Error('notification storage unavailable');
    const notificationService = {
      notify: vi.fn().mockRejectedValue(error),
    };
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(notifyInternalBestEffort({
      notificationService,
      functionName: 'phase-1-test',
      requestId: 'request-1',
      input: {
        recipientUserId: '10000000-0000-4000-8000-000000000001',
        typeKey: 'appointment.created',
        relatedEntityType: 'appointment',
        relatedEntityId: '20000000-0000-4000-8000-000000000001',
        deduplicationKey: 'appointment:20000000-0000-4000-8000-000000000001:created:patient:10000000-0000-4000-8000-000000000001',
      },
    })).resolves.toBe(false);

    expect(log).toHaveBeenCalledWith(
      '[internal-notification] notify:failed',
      expect.objectContaining({
        requestId: 'request-1',
        typeKey: 'appointment.created',
        recipientUserId: '10000000-0000-4000-8000-000000000001',
        relatedEntityType: 'appointment',
        relatedEntityId: '20000000-0000-4000-8000-000000000001',
        error,
      }),
    );

    log.mockRestore();
  });

  it('has all five Phase 1 type keys in the idempotent catalog seed', () => {
    const migration = read('supabase/migrations/20260912090000_create_internal_notifications.sql');

    for (const typeKey of [
      'appointment.created',
      'appointment.received',
      'appointment.accepted',
      'financial.payment_approved',
      'review.professional_pending',
    ]) {
      expect(migration).toContain(`('${typeKey}'`);
    }
    expect(migration).toContain('ON CONFLICT (key) DO NOTHING');
  });

  it('notifies appointment creation only after repository persistence', () => {
    const service = read('supabase/functions/create-appointment/service.ts');
    const createIndex = service.indexOf('await repository.createAppointment');
    const patientNotificationIndex = service.indexOf("typeKey: 'appointment.created'");
    const professionalNotificationIndex = service.indexOf("typeKey: 'appointment.received'");

    expect(createIndex).toBeGreaterThan(-1);
    expect(patientNotificationIndex).toBeGreaterThan(createIndex);
    expect(professionalNotificationIndex).toBeGreaterThan(createIndex);
    expect(service).toContain('if (input.professionalProfileId && professionalAppUserId)');
  });

  it('emits appointment accepted only for a new transaction', () => {
    const service = read('supabase/functions/accept-appointment/service.ts');
    const repository = read('supabase/functions/accept-appointment/repository.ts');

    expect(repository).toContain('patient_id,');
    expect(service).toContain('let acceptedNow = false');
    expect(service).toContain('acceptedNow = true');
    expect(service).toContain('if (acceptedNow && notificationService)');
    expect(service.indexOf("typeKey: 'appointment.accepted'")).toBeGreaterThan(
      service.indexOf('row = await repository.acceptAppointment'),
    );
  });

  it('uses one owner-aware deduplication key for real and simulated payment approval', () => {
    const webhook = read('supabase/functions/payments-webhook/handler.ts');
    const simulated = read('supabase/functions/_shared/payments/mark-payment-as-paid.ts');
    const helper = read('supabase/functions/_shared/payments/payment-status-notification.ts');

    expect(webhook).toContain('if (isNotifiablePaymentStatus(nextStatus))');
    expect(webhook.lastIndexOf('notifyPaymentStatusBestEffort')).toBeGreaterThan(
      webhook.indexOf('await updateOwnerPaymentStatus'),
    );
    expect(simulated.lastIndexOf('notifyPaymentStatusBestEffort')).toBeGreaterThan(
      simulated.lastIndexOf('await updateOwnerAsPaid'),
    );
    expect(helper).toContain('payment_charge:${paymentChargeId}:approved:${recipientUserId}');
    expect(helper).toContain("typeKey: 'financial.payment_approved'");
    expect(helper).toContain("solicitacao_exame: 'solicitacoes_exames'");
    expect(helper).not.toContain('providerStatus');
  });

  it('emits the review prompt only on a real transition to finalizada', () => {
    const service = read('supabase/functions/finish-consulta/service.ts');

    expect(service).toContain("const transitionedToFinalized = consultation.status !== 'finalizada'");
    expect(service).toContain('if (transitionedToFinalized && notificationService)');
    expect(service.indexOf("typeKey: 'review.professional_pending'")).toBeGreaterThan(
      service.indexOf('await repository.updateConsultationFinish'),
    );
  });
});
