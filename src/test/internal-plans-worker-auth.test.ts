import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configuredSecretKeys } from '../../supabase/functions/internal-plans-worker/auth';
import { handleInternalPlansWorkerRequest } from '../../supabase/functions/internal-plans-worker/handler';

const mocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(() => ({})),
  getRequiredEnv: vi.fn(),
  processBatch: vi.fn(async () => ({ processed: 1 })),
  enqueueMonthlyRefresh: vi.fn(),
  enqueueExpiration: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../../supabase/functions/_shared/http.ts', () => ({
  createRequestId: () => 'test-request',
  successResponse: (data: unknown) => Response.json({ data }),
  errorResponse: () => Response.json({ error: 'internal_error' }, { status: 500 }),
}));
vi.mock('../../supabase/functions/_shared/supabase.ts', () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
  getRequiredEnv: mocks.getRequiredEnv,
}));
vi.mock('../../supabase/functions/_shared/plans/internal/repositories/InternalPlansRepository.ts', () => ({
  SupabaseInternalPlansRepository: class {},
}));
vi.mock('../../supabase/functions/_shared/plans/queue/InternalPlansQueue.ts', () => ({
  InternalPlansQueue: class {
    enqueueMonthlyRefresh = mocks.enqueueMonthlyRefresh;
    enqueueExpiration = mocks.enqueueExpiration;
  },
}));
vi.mock('../../supabase/functions/_shared/plans/queue/InternalPlansJobProcessor.ts', () => ({
  InternalPlansJobProcessor: class {
    processBatch = mocks.processBatch;
  },
}));
vi.mock('../../supabase/functions/_shared/notifications/InternalNotificationService.ts', () => ({
  InternalNotificationService: class {},
}));
vi.mock('../../supabase/functions/_shared/notifications/notify-best-effort.ts', () => ({
  notifyInternalBestEffort: mocks.notify,
}));

const defaultKey = 'sb_secret_defaultKey';
const rotatedKey = 'sb_secret_rotatedKey';

function request(headers: Record<string, string> = {}) {
  return new Request('https://example.test/functions/v1/internal-plans-worker', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ limit: 50 }),
  });
}

describe('internal-plans-worker inbound secret API key authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequiredEnv.mockReturnValue(JSON.stringify({ default: defaultKey, rotated: rotatedKey }));
  });

  it.each([defaultKey, rotatedKey])('accepts a configured apikey and reaches unchanged batch logic', async (key) => {
    const response = await handleInternalPlansWorkerRequest(request({ apikey: key }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { processed: 1 } });
    expect(mocks.createServiceRoleClient).toHaveBeenCalledOnce();
    expect(mocks.processBatch).toHaveBeenCalledWith(50);
    expect(mocks.enqueueMonthlyRefresh).not.toHaveBeenCalled();
    expect(mocks.enqueueExpiration).not.toHaveBeenCalled();
  });

  it.each([
    ['missing apikey', {}],
    ['unknown apikey', { apikey: 'sb_secret_unknown' }],
    ['legacy Bearer only', { Authorization: `Bearer ${defaultKey}` }],
  ])('rejects %s with the existing 401 contract', async (_label, headers) => {
    const response = await handleInternalPlansWorkerRequest(request(headers));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
    expect(mocks.createServiceRoleClient).not.toHaveBeenCalled();
    expect(mocks.processBatch).not.toHaveBeenCalled();
  });

  it.each(['not-json', '[]', 'null', '{}', '{"default":42}',
    `{"default":"${defaultKey}","bad":42}`])('fails closed for malformed key collection', async (raw) => {
    mocks.getRequiredEnv.mockReturnValue(raw);
    const response = await handleInternalPlansWorkerRequest(request({ apikey: defaultKey }));
    expect(response.status).toBe(401);
    expect(mocks.processBatch).not.toHaveBeenCalled();
  });

  it('fails closed when the secret-key environment value is unavailable', async () => {
    mocks.getRequiredEnv.mockImplementation(() => { throw new Error('missing'); });
    const response = await handleInternalPlansWorkerRequest(request({ apikey: defaultKey }));
    expect(response.status).toBe(401);
    expect(mocks.processBatch).not.toHaveBeenCalled();
  });

  it('extracts only a well-formed named secret-key collection', () => {
    expect(configuredSecretKeys(JSON.stringify({ default: defaultKey, rotated: rotatedKey })))
      .toEqual([defaultKey, rotatedKey]);
    expect(configuredSecretKeys(JSON.stringify({ default: 'sb_publishable_wrong' }))).toEqual([]);
  });
});
