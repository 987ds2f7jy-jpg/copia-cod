import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('internal notifications Phase 2', () => {
  it('keeps every Phase 2 type key in the existing idempotent seed', () => {
    const migration = read('supabase/migrations/20260912090000_create_internal_notifications.sql');

    for (const typeKey of [
      'appointment.cancelled',
      'financial.payment_failed',
      'financial.payment_expired',
      'financial.refund_processed',
      'review.received',
      'professional.registration_approved',
      'professional.registration_rejected',
      'clinical_request.created',
      'clinical_request.accepted',
    ]) {
      expect(migration).toContain(`('${typeKey}'`);
    }
    expect(migration).toContain('ON CONFLICT (key) DO NOTHING');
  });

  it('notifies only the cancellation counterpart after the transaction', () => {
    const service = read('supabase/functions/cancel-appointment/service.ts');

    expect(service.indexOf("typeKey: 'appointment.cancelled'")).toBeGreaterThan(
      service.indexOf('await repository.cancelAppointment'),
    );
    expect(service).toContain("const recipientRole = cancelledByProfessional ? 'patient' : 'professional'");
    expect(service).toContain('findProfessionalAppUserIdByProfileId');
    expect(service).toContain('cancelledByPatient || cancelledByProfessional');
  });

  it('maps only persisted Phase 1 and Phase 2 webhook statuses', () => {
    const webhook = read('supabase/functions/payments-webhook/handler.ts');
    const helper = read('supabase/functions/_shared/payments/payment-status-notification.ts');

    expect(webhook.lastIndexOf('notifyPaymentStatusBestEffort')).toBeGreaterThan(
      webhook.indexOf('await updateOwnerPaymentStatus'),
    );
    expect(helper).toContain("payment_failed: {");
    expect(helper).toContain("typeKey: 'financial.payment_failed'");
    expect(helper).toContain("typeKey: 'financial.payment_expired'");
    expect(helper).toContain("typeKey: 'financial.refund_processed'");
    expect(helper).not.toContain('failureReason');
    expect(helper).not.toContain('providerStatus');
  });

  it('uses the consultation professional app user for the primary review flow only', () => {
    const service = read('supabase/functions/submit-consulta-evaluation/service.ts');
    const legacy = read('supabase/functions/submit-appointment-review/service.ts');

    expect(service.indexOf("typeKey: 'review.received'")).toBeGreaterThan(
      service.indexOf('await repository.createConsultaEvaluation'),
    );
    expect(service).toContain('recipientUserId: consultation.profissional_user_id');
    expect(legacy).not.toContain("typeKey: 'review.received'");
  });

  it('notifies professional review decisions only after the transactional RPC', () => {
    const service = read('supabase/functions/backoffice-review-professional/service.ts');
    const repository = read('supabase/functions/backoffice-review-professional/repository.ts');

    expect(service.lastIndexOf('notifyInternalBestEffort')).toBeGreaterThan(
      service.indexOf('await repository.review'),
    );
    expect(service).toContain("'professional.registration_approved'");
    expect(service).toContain("'professional.registration_rejected'");
    expect(repository).toContain(".select('id, user_id')");
    expect(service).not.toContain('input.reason,');
  });

  it('creates generic clinical request notifications after successful writes', () => {
    const createService = read('supabase/functions/create-solicitacao-exame/service.ts');
    const acceptService = read('supabase/functions/accept-solicitacao-exame/service.ts');

    expect(createService.indexOf("typeKey: 'clinical_request.created'")).toBeGreaterThan(
      createService.indexOf('await repository.createSolicitacaoExame'),
    );
    expect(acceptService.indexOf("typeKey: 'clinical_request.accepted'")).toBeGreaterThan(
      acceptService.indexOf('await repository.acceptSolicitacaoExame'),
    );
    expect(createService).not.toMatch(/data:\s*\{/);
    expect(acceptService).not.toMatch(/data:\s*\{/);
  });

  it('logs structured notification error fields without changing the best-effort contract', () => {
    const helper = read('supabase/functions/_shared/notifications/notify-best-effort.ts');

    expect(helper).toContain('errorMessage:');
    expect(helper).toContain('errorCode:');
    expect(helper).toContain('errorDetails:');
    expect(helper).toContain('errorHint:');
    expect(helper).toContain('return false');
  });
});
