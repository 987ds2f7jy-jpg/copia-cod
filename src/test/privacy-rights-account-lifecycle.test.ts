import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PRIVACY_DECISION_CODES,
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_TYPES,
} from '../../supabase/functions/_shared/privacy-rights';
import { deactivateAccount } from '../../supabase/functions/deactivate-account/service';
import { parseUpdateMyProfileInput } from '../../supabase/functions/update-my-profile/validation';
import type { DeactivateAccountRepository } from '../../supabase/functions/deactivate-account/types';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

function repository(overrides: Partial<DeactivateAccountRepository> = {}): DeactivateAccountRepository {
  return {
    findAppUserByAuthUserId: vi.fn().mockResolvedValue({
      id: '10000000-0000-4000-8000-000000000001', authUserId: 'auth-1', fullName: 'Test',
      email: 'test@example.invalid', role: 'patient', isActive: true, phone: '', cpf: '',
      birthDate: '', sex: '', address: '', city: '', state: '', profileComplete: false,
    }),
    hasActiveCareRelationship: vi.fn().mockResolvedValue(false),
    deactivateAppUser: vi.fn().mockImplementation(async () => ({
      id: '10000000-0000-4000-8000-000000000001', authUserId: 'auth-1', fullName: 'Test',
      email: 'test@example.invalid', role: 'patient', isActive: false, phone: '', cpf: '',
      birthDate: '', sex: '', address: '', city: '', state: '', profileComplete: false,
    })),
    disableProfessionalDuty: vi.fn().mockResolvedValue(undefined),
    writeAudit: vi.fn().mockResolvedValue(undefined),
    revokeAccessToken: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('privacy rights contracts', () => {
  it('uses canonical request types, statuses and deletion classifications', () => {
    expect(PRIVACY_REQUEST_TYPES).toContain('deletion_or_anonymization');
    expect(PRIVACY_REQUEST_TYPES).toContain('consent_information');
    expect(PRIVACY_REQUEST_STATUSES).toEqual(expect.arrayContaining(['submitted', 'in_review', 'partially_approved', 'completed']));
    expect(PRIVACY_DECISION_CODES).toEqual(expect.arrayContaining(['partial_anonymization', 'retention_required', 'legal_or_regulatory_hold']));
  });

  it('keeps the queue private, idempotent and non-destructive', () => {
    const migration = read('supabase/migrations/20260712230000_add_privacy_rights_account_lifecycle.sql');
    expect(migration).toContain('force row level security');
    expect(migration).toContain('revoke all on table public.privacy_rights_requests from public, anon, authenticated');
    expect(migration).toContain('privacy_rights_requests_idempotency_unique');
    expect(migration).toContain('idx_privacy_rights_requests_open_fingerprint');
    expect(migration).not.toMatch(/delete\s+from\s+public\.(app_users|prontuarios|consultas|payment_charges)/i);
    expect(migration).not.toMatch(/grant\s+(select|insert|update|delete).*authenticated/i);
  });

  it('never trusts user, status, decision or assignee from request creation', () => {
    const source = read('supabase/functions/create-privacy-rights-request/index.ts');
    expect(source).toContain('requester_user_id: user.id');
    expect(source).toContain('requirePrivacyRequestType(body.requestType)');
    expect(source).not.toMatch(/requester_user_id:\s*body|status:\s*body|assigned_admin_user_id:\s*body|decision_code:\s*body/);
    expect(source).toContain('OPEN_PRIVACY_STATUSES');
  });

  it('filters self-service reads by authenticated app user and hides internal notes', () => {
    const source = read('supabase/functions/get-my-privacy-rights-requests/index.ts');
    expect(source).toContain(".eq('requester_user_id', user.id)");
    const mapper = read('supabase/functions/_shared/privacy-rights.ts');
    const mapperSource = mapper.slice(mapper.indexOf('export function mapSelfServicePrivacyRequest'));
    expect(mapperSource).not.toContain('decisionNote:');
    expect(mapperSource).not.toContain('exportStoragePath:');
  });

  it('requires admin role and conditional version updates for review', () => {
    const queue = read('supabase/functions/get-admin-privacy-rights-queue/index.ts');
    const review = read('supabase/functions/review-privacy-rights-request/index.ts');
    expect(queue).toContain("requireRole(admin, ['admin'])");
    expect(review).toContain("requireRole(admin, ['admin'])");
    expect(review).toContain(".eq('review_version', expectedVersion)");
    expect(review).toContain('ALLOWED_STATUS_TRANSITIONS');
    expect(review).not.toMatch(/\.delete\(|auth\.admin\.deleteUser|status:\s*body\.status/);
  });
});

describe('account lifecycle', () => {
  it('blocks deactivation while a care relationship is active', async () => {
    const repo = repository({ hasActiveCareRelationship: vi.fn().mockResolvedValue(true) });
    await expect(deactivateAccount({
      requestId: 'req-active', authenticatedUser: { authUserId: 'auth-1' }, accessToken: 'session-token',
      input: { confirmation: 'DEACTIVATE_MY_ACCOUNT' }, repository: repo,
    })).rejects.toMatchObject({ code: 'ACCOUNT_DEACTIVATION_ACTIVE_RELATIONSHIP' });
    expect(repo.deactivateAppUser).not.toHaveBeenCalled();
  });

  it('soft-deactivates, revokes sessions and preserves stored records', async () => {
    const repo = repository();
    const result = await deactivateAccount({
      requestId: 'req-ok', authenticatedUser: { authUserId: 'auth-1' }, accessToken: 'session-token',
      input: { confirmation: 'DEACTIVATE_MY_ACCOUNT' }, repository: repo,
    });
    expect(result.deactivated).toBe(true);
    expect(repo.deactivateAppUser).toHaveBeenCalledTimes(1);
    expect(repo.revokeAccessToken).toHaveBeenCalledTimes(1);
    expect(repo.writeAudit).toHaveBeenCalledTimes(1);
    const source = read('supabase/functions/deactivate-account/repository.ts');
    expect(source).toContain('is_active: false');
    expect(source).not.toMatch(/\.delete\(|auth\.admin\.deleteUser/);
  });

  it('routes CPF and identity-name corrections to review', () => {
    expect(() => parseUpdateMyProfileInput({ cpf: '00000000000' })).toThrowError(expect.objectContaining({ code: 'PROFILE_IDENTITY_CORRECTION_REVIEW_REQUIRED' }));
    expect(() => parseUpdateMyProfileInput({ fullName: 'Changed' })).toThrowError(expect.objectContaining({ code: 'PROFILE_IDENTITY_CORRECTION_REVIEW_REQUIRED' }));
    expect(parseUpdateMyProfileInput({ phone: '11999999999', city: 'Sao Paulo' })).toMatchObject({ phone: '11999999999', city: 'Sao Paulo' });
    const updateEndpoint = read('supabase/functions/update-my-profile/repository.ts');
    expect(updateEndpoint).not.toContain(".from('prontuarios')");
    const bankingService = read('supabase/functions/upsert-professional-banking-data/service.ts');
    const bankingRepository = read('supabase/functions/upsert-professional-banking-data/repository.ts');
    expect(bankingService).toContain('BANKING_DATA_CORRECTION_REVIEW_REQUIRED');
    expect(bankingRepository).not.toContain("select('*')");
  });
});

describe('private JSON export', () => {
  it('uses explicit projections, ownership checks, size limit and a short signed URL', () => {
    const source = read('supabase/functions/generate-my-privacy-data-export/index.ts');
    expect(source).not.toContain("select('*')");
    expect(source).toContain(".eq('requester_user_id', user.id)");
    expect(source).toContain(".eq('request_type', 'export')");
    expect(source).toContain('MAX_EXPORT_BYTES = 5 * 1024 * 1024');
    expect(source).toContain('SIGNED_URL_TTL_SECONDS = 5 * 60');
    expect(source).toContain("const BUCKET = 'privacy-exports'");
    expect(source).toContain('if (privacyRequest.export_storage_path)');
    expect(source).toContain('reused: true');
    expect(source).not.toMatch(/last_provider_payload|decision_note|password_hash|session_token|token_expires_at/);
  });

  it('keeps the bucket private and never logs export content', () => {
    const migration = read('supabase/migrations/20260712230000_add_privacy_rights_account_lifecycle.sql');
    const source = read('supabase/functions/generate-my-privacy-data-export/index.ts');
    expect(migration).toMatch(/'privacy-exports',[\s\S]*?false,[\s\S]*?5242880/);
    expect(migration).not.toMatch(/privacy-exports[\s\S]*?create policy/i);
    const logCalls = source.match(/logTechnicalEvent\([\s\S]*?\);/g)?.join('\n') || '';
    expect(logCalls).not.toMatch(/json|document|medicalRecords|prontuario|export_storage_path/i);
  });
});
