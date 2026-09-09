import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../supabase/functions/_shared/errors';
import { requireActiveBackofficeAdmin } from '../../supabase/functions/_shared/backofficeAuth';
import { reviewBackofficeProfessional } from '../../supabase/functions/backoffice-review-professional/service';
import { parseBackofficeReviewProfessionalInput } from '../../supabase/functions/backoffice-review-professional/validation';

vi.mock('../../supabase/functions/_shared/backofficeAuth', () => ({
  requireActiveBackofficeAdmin: vi.fn(),
}));

const professionalProfileId = '10000000-0000-4000-8000-000000000001';
const adminUserId = '20000000-0000-4000-8000-000000000001';

function createRepository(overrides: Record<string, unknown> = {}) {
  return {
    review: vi.fn().mockResolvedValue({
      professional_profile_id: professionalProfileId,
      status: 'approved',
      is_verified: true,
    }),
    ...overrides,
  };
}

async function reviewWith(repository: ReturnType<typeof createRepository>) {
  return reviewBackofficeProfessional({
    req: new Request('https://example.test/functions/v1/backoffice-review-professional', {
      method: 'POST',
      headers: { Authorization: 'Bearer administrative-token' },
    }),
    client: {} as never,
    repository: repository as never,
    input: { professionalProfileId, action: 'approve', reason: null },
    requestId: 'request-review-1',
  });
}

describe('backoffice professional review contract', () => {
  beforeEach(() => {
    vi.mocked(requireActiveBackofficeAdmin).mockReset();
    vi.mocked(requireActiveBackofficeAdmin).mockResolvedValue({ id: adminUserId, email: 'admin@example.test' });
  });

  it('accepts the frontend payload contract and forwards the private profile ID to the review RPC', async () => {
    expect(parseBackofficeReviewProfessionalInput({ professionalProfileId, action: 'approve' })).toEqual({
      professionalProfileId,
      action: 'approve',
      reason: null,
    });

    const repository = createRepository();
    await expect(reviewWith(repository)).resolves.toEqual({
      professional: {
        professional_profile_id: professionalProfileId,
        status: 'approved',
        is_verified: true,
      },
    });
    expect(repository.review).toHaveBeenCalledWith({
      professionalProfileId,
      action: 'approve',
      reason: null,
      adminUserId,
      requestId: 'request-review-1',
    });
  });

  it('does not call the repository when administrative authentication is absent or invalid', async () => {
    vi.mocked(requireActiveBackofficeAdmin).mockRejectedValueOnce(new AppError({
      status: 401,
      code: 'ADMIN_AUTHORIZATION_REQUIRED',
      message: 'Administrative authorization is required.',
    }));
    const repository = createRepository();

    await expect(reviewWith(repository)).rejects.toMatchObject({ status: 401, code: 'ADMIN_AUTHORIZATION_REQUIRED' });
    expect(repository.review).not.toHaveBeenCalled();
  });

  it('does not call the repository for a non-administrative token', async () => {
    vi.mocked(requireActiveBackofficeAdmin).mockRejectedValueOnce(new AppError({
      status: 401,
      code: 'ADMIN_TOKEN_INVALID',
      message: 'Invalid administrative session.',
    }));
    const repository = createRepository();

    await expect(reviewWith(repository)).rejects.toMatchObject({ status: 401, code: 'ADMIN_TOKEN_INVALID' });
    expect(repository.review).not.toHaveBeenCalled();
  });

  it.each([
    ['missing private profile', 404, 'PROFESSIONAL_PROFILE_NOT_FOUND'],
    ['already reviewed private profile', 409, 'PROFESSIONAL_PROFILE_NOT_PENDING'],
  ])('preserves %s failures without reporting a successful review', async (_label, status, code) => {
    const repository = createRepository({
      review: vi.fn().mockRejectedValue(new AppError({ status, code, message: code })),
    });

    await expect(reviewWith(repository)).rejects.toMatchObject({ status, code });
  });

  it('maps RPC failures and passes only professional_profiles.id to the RPC contract', () => {
    const repository = readFileSync(resolve(process.cwd(), 'supabase/functions/backoffice-review-professional/repository.ts'), 'utf8');

    expect(repository).toContain("const rpcName = 'review_backoffice_professional'");
    expect(repository).toContain('p_professional_profile_id: input.professionalProfileId');
    expect(repository).toContain('p_admin_user_id: input.adminUserId');
    expect(repository).toContain('p_action: input.action');
    expect(repository).toContain('p_reason: input.reason');
    expect(repository).toContain("'PROFESSIONAL_PROFILE_NOT_FOUND'");
    expect(repository).toContain("'PROFESSIONAL_PROFILE_NOT_PENDING'");
    expect(repository).not.toContain('professionalId: input.professionalProfileId');
  });

  it('keeps the review atomic and uses qualified private and public profile columns in the corrective RPC', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260903090000_fix_backoffice_professional_review_rpc.sql'), 'utf8');

    expect(migration).toContain("IF v_profile.status <> 'pending'");
    expect(migration).toContain("THEN 'approved' ELSE 'rejected'");
    expect(migration).toContain('UPDATE public.professional_profiles AS private_profile');
    expect(migration).toContain('WHERE private_profile.id = p_professional_profile_id');
    expect(migration).toContain('UPDATE public.professional_public_profiles AS public_profile');
    expect(migration).toContain('WHERE public_profile.professional_profile_id = p_professional_profile_id::TEXT');
    expect(migration).toContain('AND public_profile.status = \'pending_review\'');
    expect(migration).toContain('INSERT INTO public.backoffice_audit_events');
    expect(migration).toMatch(/^BEGIN;[\s\S]*COMMIT;\s*$/);
  });
});
