import { describe, expect, it } from 'vitest';
import { isWorkerSecretKeyAuthorized } from '../../supabase/functions/internal-plans-worker/worker-auth';

const keys = JSON.stringify({ default: 'sb_secret_current', other: 'sb_secret_rotated' });

describe('internal Plans worker credential', () => {
  it('accepts configured secret keys by exact apikey match', () => {
    expect(isWorkerSecretKeyAuthorized('sb_secret_current', keys)).toBe(true);
    expect(isWorkerSecretKeyAuthorized('sb_secret_rotated', keys)).toBe(true);
  });

  it('rejects missing, unconfigured, publishable, and partial keys', () => {
    expect(isWorkerSecretKeyAuthorized(null, keys)).toBe(false);
    expect(isWorkerSecretKeyAuthorized('sb_secret_unknown', keys)).toBe(false);
    expect(isWorkerSecretKeyAuthorized('sb_secret_current ', keys)).toBe(false);
    expect(isWorkerSecretKeyAuthorized('sb_publishable_client', keys)).toBe(false);
    expect(isWorkerSecretKeyAuthorized('Bearer sb_secret_current', keys)).toBe(false);
  });

  it('fails closed when runtime configuration is missing or malformed', () => {
    expect(isWorkerSecretKeyAuthorized('sb_secret_current', undefined)).toBe(false);
    expect(isWorkerSecretKeyAuthorized('sb_secret_current', '{')).toBe(false);
    expect(isWorkerSecretKeyAuthorized('sb_secret_current', '[]')).toBe(false);
    expect(isWorkerSecretKeyAuthorized('sb_secret_current', '{}')).toBe(false);
    expect(isWorkerSecretKeyAuthorized('sb_secret_current', '{"default":123}')).toBe(false);
    expect(isWorkerSecretKeyAuthorized('sb_secret_current', '{"default":"service_role_jwt"}')).toBe(false);
  });
});
