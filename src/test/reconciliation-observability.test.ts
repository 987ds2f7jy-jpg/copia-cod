import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  buildTechnicalLog,
  sanitizeAuditMetadata,
} from '../../supabase/functions/_shared/observability';
import { AppError } from '../../supabase/functions/_shared/errors';
import { getReconciliationQueue } from '../../supabase/functions/get-reconciliation-queue/service';
import { parseReconcileFinancialOwnerInput } from '../../supabase/functions/reconcile-financial-owner/validation';
import {
  reconcileFinancialOwner,
  resolveExternalCreditStatus,
} from '../../supabase/functions/reconcile-financial-owner/service';
import type { AppUser } from '../../supabase/functions/_shared/professional';
import { requireRole } from '../../supabase/functions/_shared/professional';
import type { ReconcileFinancialOwnerRepository } from '../../supabase/functions/reconcile-financial-owner/types';

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260712200000_add_safe_audit_and_reconciliation.sql'),
  'utf8',
);
const admin: AppUser = {
  id: '10000000-0000-4000-8000-000000000001',
  authUserId: 'auth-admin',
  role: 'admin',
  isActive: true,
  fullName: 'Admin Test',
  email: 'admin@example.invalid',
};
const command = {
  requestId: 'request-1',
  input: {
    ownerType: 'appointment' as const,
    ownerId: '20000000-0000-4000-8000-000000000001',
  },
  authenticatedUser: { authUserId: 'auth-admin' },
  admin,
};

function repository(overrides: Partial<ReconcileFinancialOwnerRepository> = {}): ReconcileFinancialOwnerRepository {
  return {
    acquireClaim: vi.fn().mockResolvedValue(true),
    releaseClaim: vi.fn().mockResolvedValue(undefined),
    listIssues: vi.fn().mockResolvedValue([]),
    reconcilePayment: vi.fn().mockResolvedValue({
      attempted: false, changed: false, status: 'skipped', reasonCode: 'NOT_REQUIRED',
    }),
    reconcilePlanCredit: vi.fn().mockResolvedValue({
      attempted: false, changed: false, status: 'skipped', reasonCode: 'NOT_REQUIRED',
    }),
    writeAudit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('safe observability and reconciliation', () => {
  it('keeps only allowlisted technical log fields', () => {
    const log = buildTechnicalLog({
      functionName: 'test',
      requestId: 'request',
      operation: 'payment.reconcile',
      actorId: 'actor-id',
      actorRole: 'admin',
      resourceType: 'appointment',
      resourceId: 'resource-id',
      status: 'failed',
      errorCode: 'SAFE_CODE',
      provider: 'stripe',
    });

    expect(log).not.toHaveProperty('authorization');
    expect(log).not.toHaveProperty('payload');
    expect(log).not.toHaveProperty('prontuario');
    expect(JSON.stringify(log)).not.toContain('Bearer');
  });

  it('sanitizes audit metadata with an explicit allowlist', () => {
    expect(sanitizeAuditMetadata({
      provider: 'stripe',
      reason_code: 'TIMEOUT',
      authorization: 'Bearer secret',
      jwt: 'token',
      prontuario: 'medical data',
      payload: { secret: true },
      bank_account: '123',
    })).toEqual({ provider: 'stripe', reason_code: 'TIMEOUT' });
  });

  it('ignores status and amount supplied by an admin client', () => {
    expect(parseReconcileFinancialOwnerInput({
      ownerType: 'appointment',
      ownerId: command.input.ownerId,
      status: 'paid',
      amount: 0.01,
      serviceReleased: true,
    })).toEqual(command.input);
  });

  it('rejects patient and professional roles from administrative operations', () => {
    for (const role of ['patient', 'professional'] as const) {
      expect(() => requireRole({ ...admin, role }, ['admin'])).toThrowError(
        expect.objectContaining({ status: 403, code: 'ROLE_FORBIDDEN' }),
      );
    }
  });

  it('returns an already consistent owner without external retries', async () => {
    const repo = repository();
    const result = await reconcileFinancialOwner({ ...command, repository: repo });

    expect(result.status).toBe('already_consistent');
    expect(repo.reconcilePayment).not.toHaveBeenCalled();
    expect(repo.reconcilePlanCredit).not.toHaveBeenCalled();
    expect(repo.releaseClaim).toHaveBeenCalledTimes(1);
  });

  it('keeps an ambiguous external response blocked for manual review', async () => {
    const repo = repository({
      listIssues: vi.fn()
        .mockResolvedValueOnce([{ issue_type: 'plan_reconciliation_required', reason_code: 'PLAN_RECONCILIATION_REQUIRED' }])
        .mockResolvedValueOnce([{ issue_type: 'plan_reconciliation_required', reason_code: 'PLAN_CREDIT_NOT_CONFIRMED_EXTERNALLY' }]),
      reconcilePlanCredit: vi.fn().mockResolvedValue({
        attempted: true,
        changed: false,
        status: 'manual_review_required',
        reasonCode: 'PLAN_CREDIT_NOT_CONFIRMED_EXTERNALLY',
      }),
    });

    const result = await reconcileFinancialOwner({ ...command, repository: repo });
    expect(result.status).toBe('manual_review_required');
    expect(result.remainingIssues).toHaveLength(1);
  });

  it('rejects a concurrent reconciliation claim', async () => {
    const repo = repository({ acquireClaim: vi.fn().mockResolvedValue(false) });
    await expect(reconcileFinancialOwner({ ...command, repository: repo })).rejects.toMatchObject({
      status: 409,
      code: 'RECONCILIATION_ALREADY_IN_PROGRESS',
    } satisfies Partial<AppError>);
  });

  it('recognizes only a confirmed external used score', () => {
    expect(resolveExternalCreditStatus([{ scores: [{
      subscription_score_id: '51', status_label: 'used', payload: 'ignored',
    }] }], '51')).toBe('used');
    expect(resolveExternalCreditStatus([{ scores: [{
      subscription_score_id: '51', status_label: 'available',
    }] }], '51')).toBe('available');
  });

  it('normalizes the admin queue without exposing sensitive fields', async () => {
    const writeAccessAudit = vi.fn().mockResolvedValue(undefined);
    const result = await getReconciliationQueue({
      requestId: 'queue-request',
      input: { page: 1, pageSize: 25 },
      authenticatedUser: { authUserId: 'auth-admin' },
      admin,
      repository: {
        list: vi.fn().mockResolvedValue({
          total: 1,
          rows: [{
            issue_type: 'payment_paid_owner_not_released',
            severity: 'high',
            owner_type: 'appointment',
            owner_id: command.input.ownerId,
            status: 'open',
            resource_status: 'requested',
            reason_code: 'OWNER_PAYMENT_STATE_NOT_PAID',
            source_updated_at: '2026-07-12T00:00:00Z',
            payment_charge_id: '30000000-0000-4000-8000-000000000001',
            plan_credit_usage_id: null,
            provider: 'stripe',
          }],
        }),
        writeAccessAudit,
      },
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('prontuario');
    expect(serialized).not.toContain('payload');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('bank');
    expect(writeAccessAudit).toHaveBeenCalledTimes(1);
  });

  it('defines all required detectors and keeps audit tables private', () => {
    for (const detector of [
      'payment_paid_owner_not_released',
      'released_without_valid_funding',
      'released_without_valid_plan_coverage',
      'multiple_active_payment_charges',
      'paid_charge_owner_missing',
      'webhook_processing_stalled',
      'plan_reconciliation_required',
      'plan_credit_usage_stalled',
      'plan_used_without_used_usage',
      'used_plan_credit_owner_missing',
      'duplicate_external_plan_credit',
      'plan_owner_with_active_charge',
      'self_pay_owner_with_plan_credit',
      'plan_owner_missing_credit_identity',
      'owner_intermediate_state_stalled',
    ]) expect(migration).toContain(`'${detector}'`);

    expect(migration).toContain('ALTER TABLE public.system_audit_events FORCE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON TABLE public.system_audit_events FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('GRANT SELECT, INSERT ON TABLE public.system_audit_events TO service_role');
    expect(migration).not.toContain('GRANT SELECT ON TABLE public.system_audit_events TO authenticated');
  });
});
