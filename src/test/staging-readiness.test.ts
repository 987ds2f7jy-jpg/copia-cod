import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error The readiness checker is an executable ESM module without declarations.
import { evaluateStagingReadiness } from '../../scripts/check-staging-readiness.mjs';
import {
  isCorsOriginAllowed,
  resolveAllowedCorsOrigins,
} from '../../supabase/functions/_shared/cors-policy.ts';
import { handlePreflight } from '../../supabase/functions/_shared/http.ts';

const root = process.cwd();
const temporaryDirectories: string[] = [];

function createValidEnvironment(): Record<string, string> {
  return {
    VITE_APP_ENV: 'staging',
    VITE_SUPABASE_URL: 'https://staging-project.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'public-anon-value',
    VITE_SITE_URL: 'https://staging.rapido.example',
    VITE_MAPBOX_TOKEN: 'public-mapbox-value',
    VITE_ENABLE_PAYMENT_SIMULATION: 'false',
    APP_ENV: 'staging',
    APP_BASE_URL: 'https://staging.rapido.example',
    EDGE_ALLOWED_ORIGINS: 'https://staging.rapido.example',
    SUPABASE_URL: 'https://staging-project.supabase.co',
    SUPABASE_ANON_KEY: 'public-edge-anon-value',
    SUPABASE_SERVICE_ROLE_KEY: 'server-only-service-role-value',
    PAYMENT_PROVIDER: 'stripe',
    ENABLE_PAYMENT_SIMULATION: 'false',
    STRIPE_SECRET_KEY: 'server-only-stripe-value',
    STRIPE_WEBHOOK_SECRET: 'server-only-webhook-value',
    PLANS_SERVICE_BASE_URL: 'https://plans.staging.example',
    PLANS_SERVICE_INTERNAL_API_KEY: 'server-only-plans-value',
    PLANS_SERVICE_TIMEOUT_MS: '8000',
    ZOOM_VIDEO_SDK_KEY: 'server-side-zoom-id',
    ZOOM_VIDEO_SDK_SECRET: 'server-only-zoom-value',
    ZOOM_WEBHOOK_SECRET_TOKEN: 'server-only-zoom-webhook-value',
    DEEPGRAM_API_KEY: 'server-only-deepgram-value',
    DEEPGRAM_TIMEOUT_MS: '8000',
    GROQ_API_KEY: 'server-only-groq-value',
    GROQ_TIMEOUT_MS: '12000',
    GROQ_MAX_TRANSCRIPT_CHARS: '50000',
  };
}

function errorCodes(env: Record<string, string>) {
  return evaluateStagingReadiness(env, { root }).errors.map((item: { code: string }) => item.code);
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe('staging readiness', () => {
  it('accepts the minimum safe configuration and public Mapbox token', () => {
    const result = evaluateStagingReadiness(createValidEnvironment(), { root });
    expect(result.errors).toEqual([]);
  });

  it('requires explicit staging environments', () => {
    const env = createValidEnvironment();
    env.APP_ENV = 'development';
    expect(errorCodes(env)).toContain('APP_ENV_NOT_STAGING');
  });

  it('blocks mock providers and browser payment simulation', () => {
    const env = createValidEnvironment();
    env.PAYMENT_PROVIDER = 'mock';
    env.ENABLE_PAYMENT_SIMULATION = 'true';
    env.VITE_ENABLE_PAYMENT_SIMULATION = 'true';
    const codes = errorCodes(env);
    expect(codes).toContain('PAYMENT_MOCK_FORBIDDEN');
    expect(codes).toContain('PAYMENT_SIMULATION_ENABLED');
    expect(codes).toContain('FRONTEND_PAYMENT_SIMULATION_ENABLED');
  });

  it('blocks localhost and private VITE names', () => {
    const env = createValidEnvironment();
    env.VITE_SITE_URL = 'http://localhost:8080';
    env.VITE_PAYMENT_WEBHOOK_SECRET = 'must-not-be-public';
    const codes = errorCodes(env);
    expect(codes).toContain('LOCALHOST_IN_STAGING');
    expect(codes).toContain('PRIVATE_VALUE_IN_FRONTEND');
  });

  it('reports the legacy plans alias without accepting it as canonical', () => {
    const env = createValidEnvironment();
    env.PLANS_SERVICE_URL = env.PLANS_SERVICE_BASE_URL;
    const result = evaluateStagingReadiness(env, { root });
    expect(result.warnings.map((item: { code: string }) => item.code)).toContain('DEPRECATED_ALIAS');
  });

  it('never prints configured values', () => {
    const directory = mkdtempSync(join(tmpdir(), 'rd-staging-readiness-'));
    temporaryDirectories.push(directory);
    const frontendFile = join(directory, '.env.staging');
    const secretsFile = join(directory, '.env.staging.secrets');
    const secretSentinel = 'secret-value-that-must-not-be-printed';
    const env = { ...createValidEnvironment(), STRIPE_SECRET_KEY: secretSentinel, APP_ENV: 'development' };
    writeFileSync(frontendFile, Object.entries(env).filter(([key]) => key.startsWith('VITE_')).map(([key, value]) => `${key}=${value}`).join('\n'));
    writeFileSync(secretsFile, Object.entries(env).filter(([key]) => !key.startsWith('VITE_')).map(([key, value]) => `${key}=${value}`).join('\n'));
    const result = spawnSync(process.execPath, [
      'scripts/check-staging-readiness.mjs',
      '--frontend',
      frontendFile,
      '--secrets',
      secretsFile,
    ], {
      cwd: root,
      encoding: 'utf8',
      env: {},
    });
    const output = `${result.stdout}${result.stderr}`;
    expect(result.status).toBe(1);
    expect(output).toContain('APP_ENV_NOT_STAGING');
    expect(output).not.toContain(secretSentinel);
  });

  it('rejects scope confusion between frontend env and server-side secrets files', () => {
    const directory = mkdtempSync(join(tmpdir(), 'rd-staging-readiness-'));
    temporaryDirectories.push(directory);
    const frontendFile = join(directory, '.env.staging');
    const secretsFile = join(directory, '.env.staging.secrets');
    writeFileSync(frontendFile, 'APP_ENV=staging\nVITE_APP_ENV=staging\n');
    writeFileSync(secretsFile, 'VITE_APP_ENV=staging\nAPP_ENV=staging\n');
    const result = spawnSync(process.execPath, [
      'scripts/check-staging-readiness.mjs',
      '--frontend',
      frontendFile,
      '--secrets',
      secretsFile,
    ], {
      cwd: root,
      encoding: 'utf8',
      env: {},
    });
    const output = `${result.stdout}${result.stderr}`;
    expect(result.status).toBe(1);
    expect(output).toContain('SERVER_VARIABLE_IN_FRONTEND_FILE');
    expect(output).toContain('FRONTEND_VARIABLE_IN_SECRETS_FILE');
  });
});

describe('Edge Function CORS policy', () => {
  it('allows only the configured staging origin', () => {
    const origins = resolveAllowedCorsOrigins({
      appEnvironment: 'staging',
      configuredOrigins: 'https://staging.rapido.example',
    });
    expect(isCorsOriginAllowed('https://staging.rapido.example', origins)).toBe(true);
    expect(isCorsOriginAllowed('https://attacker.example', origins)).toBe(false);
    expect(isCorsOriginAllowed('http://localhost:8080', origins)).toBe(false);
  });

  it('uses localhost only for development without explicit configuration', () => {
    expect(resolveAllowedCorsOrigins({ appEnvironment: 'development', configuredOrigins: '' }))
      .toEqual(['http://localhost:8080']);
    expect(resolveAllowedCorsOrigins({ appEnvironment: 'staging', configuredOrigins: '' }))
      .toEqual([]);
  });

  it('rejects a preflight request from an unknown origin', async () => {
    const runtime = globalThis as unknown as { Deno?: { env: { get: (name: string) => string | undefined } } };
    const previousDeno = runtime.Deno;
    runtime.Deno = {
      env: {
        get: (name) => ({
          APP_ENV: 'staging',
          EDGE_ALLOWED_ORIGINS: 'https://staging.rapido.example',
        } as Record<string, string>)[name],
      },
    };

    try {
      const response = handlePreflight(new Request('https://edge.example/function', {
        method: 'OPTIONS',
        headers: { Origin: 'https://attacker.example' },
      }));
      expect(response?.status).toBe(403);
      expect(response?.headers.get('Access-Control-Allow-Origin')).not.toBe('*');
    } finally {
      runtime.Deno = previousDeno;
    }
  });
});

describe('staging source hygiene', () => {
  it('has no operational Lovable/Base44 dependency and keeps plans server-side', () => {
    const packageJson = readFileSync(join(root, 'package.json'), 'utf8');
    const viteConfig = readFileSync(join(root, 'vite.config.ts'), 'utf8');
    const clientSource = readFileSync(join(root, 'src/client-api/plans.js'), 'utf8');
    const deployScript = readFileSync(join(root, 'scripts/deploy-staging-functions.ps1'), 'utf8');
    expect(`${packageJson}\n${viteConfig}`).not.toMatch(/lovable|base44/i);
    expect(viteConfig).not.toMatch(/envPrefix:\s*["']VITE_["']/);
    expect(viteConfig).toContain('"VITE_SUPABASE_URL"');
    expect(viteConfig).toContain('"VITE_ENABLE_PAYMENT_SIMULATION"');
    expect(clientSource).not.toMatch(/plans-service|PLANS_SERVICE_INTERNAL_API_KEY/i);
    expect(deployScript).not.toMatch(/"simulate-payment-paid"\s*,/);
    expect(deployScript).toContain('must not be deployed to staging');
  });
});
