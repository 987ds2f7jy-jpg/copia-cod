import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LEGAL_DOCUMENTS } from '../../supabase/functions/_shared/legal-documents';
import { parseBootstrapAppUserInput } from '../../supabase/functions/bootstrap-app-user/validation';
import { bootstrapAppUser } from '../../supabase/functions/bootstrap-app-user/service';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

function createRepository(overrides: Record<string, unknown> = {}) {
  return {
    findAppUserByAuthUserId: vi.fn().mockResolvedValue(null),
    findAppUserByEmail: vi.fn().mockResolvedValue(null),
    createAuthUser: vi.fn().mockResolvedValue({ authUserId: 'auth-1', email: 'patient@example.test' }),
    deleteAuthUser: vi.fn().mockResolvedValue(undefined),
    deleteAppUser: vi.fn().mockResolvedValue(undefined),
    createAppUser: vi.fn().mockResolvedValue({
      id: 'app-1', authUserId: 'auth-1', fullName: 'Test User', email: 'patient@example.test',
      role: 'patient', isActive: true, phone: '', cpf: '', birthDate: '', sex: '', address: '',
      city: '', state: '', profileComplete: false,
    }),
    updateAppUser: vi.fn(),
    recordSignupLegalEvents: vi.fn().mockResolvedValue([
      { documentKey: 'terms_of_use', documentVersion: '1.0.0', eventType: 'accepted' },
      { documentKey: 'privacy_notice', documentVersion: '1.0.0', eventType: 'acknowledged' },
    ]),
    signInWithPassword: vi.fn().mockResolvedValue({
      accessToken: 'access', refreshToken: 'refresh', expiresAt: null, expiresIn: null, tokenType: 'bearer',
    }),
    ...overrides,
  };
}

const signupInput = {
  email: 'patient@example.test', password: 'strong-pass', fullName: 'Test User', role: 'patient' as const,
  phone: '', cpf: '', birthDate: '', sex: '', address: '', city: '', state: '',
  termsAccepted: true, privacyAcknowledged: true,
};

describe('canonical legal documents', () => {
  it('keeps acceptance and privacy acknowledgement separate and versioned', () => {
    expect(LEGAL_DOCUMENTS.terms_of_use.allowedEvent).toBe('accepted');
    expect(LEGAL_DOCUMENTS.terms_of_use.requiresAcceptance).toBe(true);
    expect(LEGAL_DOCUMENTS.privacy_notice.allowedEvent).toBe('acknowledged');
    expect(LEGAL_DOCUMENTS.privacy_notice.requiresAcceptance).toBe(false);
    expect(LEGAL_DOCUMENTS.terms_of_use.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('does not accept a client-supplied legal version, user id or timestamp', () => {
    const parsed = parseBootstrapAppUserInput({
      ...signupInput,
      documentVersion: '999.0.0',
      userId: 'another-user',
      occurredAt: '2000-01-01T00:00:00Z',
    });
    expect(parsed).not.toHaveProperty('documentVersion');
    expect(parsed).not.toHaveProperty('userId');
    expect(parsed).not.toHaveProperty('occurredAt');
  });
});

describe('signup legal event integrity', () => {
  it('requires both separate declarations for new accounts', async () => {
    const repository = createRepository();
    await expect(bootstrapAppUser({
      requestId: 'req-1', input: { ...signupInput, privacyAcknowledged: false },
      authenticatedUser: null, repository,
    })).rejects.toMatchObject({ code: 'LEGAL_ACKNOWLEDGEMENTS_REQUIRED' });
    expect(repository.createAuthUser).not.toHaveBeenCalled();
  });

  it('records accepted terms and acknowledged privacy with backend versions', async () => {
    const repository = createRepository();
    const result = await bootstrapAppUser({
      requestId: 'req-2', input: signupInput, authenticatedUser: null, repository,
    });
    expect(repository.recordSignupLegalEvents).toHaveBeenCalledWith({ userId: 'app-1', role: 'patient' });
    expect(result.legalEvents).toEqual([
      { documentKey: 'terms_of_use', documentVersion: '1.0.0', eventType: 'accepted' },
      { documentKey: 'privacy_notice', documentVersion: '1.0.0', eventType: 'acknowledged' },
    ]);
  });

  it('does not report signup completion when required event persistence fails', async () => {
    const repository = createRepository({
      recordSignupLegalEvents: vi.fn().mockRejectedValue(new Error('write failed')),
    });
    await expect(bootstrapAppUser({
      requestId: 'req-3', input: signupInput, authenticatedUser: null, repository,
    })).rejects.toThrow('write failed');
    expect(repository.deleteAppUser).toHaveBeenCalledWith('app-1');
    expect(repository.deleteAuthUser).toHaveBeenCalledWith('auth-1');
  });

  it('does not block session restore for accounts created before this version', async () => {
    const existingUser = {
      id: 'app-old', authUserId: 'auth-old', fullName: 'Existing User', email: 'existing@example.test',
      role: 'patient', isActive: true, phone: '', cpf: '', birthDate: '', sex: '', address: '',
      city: '', state: '', profileComplete: false,
    };
    const repository = createRepository({
      findAppUserByAuthUserId: vi.fn().mockResolvedValue(existingUser),
    });
    const result = await bootstrapAppUser({
      requestId: 'req-old',
      input: {
        email: null, password: null, fullName: null, role: null, phone: '', cpf: '', birthDate: '',
        sex: '', address: '', city: '', state: '', termsAccepted: false, privacyAcknowledged: false,
      },
      authenticatedUser: {
        authUserId: 'auth-old', email: 'existing@example.test', fullName: 'Existing User', role: 'patient',
      },
      repository,
    });
    expect(result.appUser.id).toBe('app-old');
    expect(repository.recordSignupLegalEvents).not.toHaveBeenCalled();
  });
});

describe('legal UI and database boundaries', () => {
  it('uses two distinct checkboxes in both signup flows', () => {
    for (const path of ['src/pages/CadastroPaciente.jsx', 'src/pages/CadastroProfissional.jsx']) {
      const source = read(path);
      expect(source).toContain('termsAccepted');
      expect(source).toContain('privacyAcknowledged');
      expect(source).toContain('Li e aceito os');
      expect(source).toContain('Declaro que tive acesso ao');
    }
  });

  it('keeps the legal event table private and idempotent', () => {
    const migration = read('supabase/migrations/20260712210000_add_legal_user_events.sql');
    expect(migration).toContain('force row level security');
    expect(migration).toContain('revoke all on table public.legal_user_events from public, anon, authenticated');
    expect(migration).toContain('unique (user_id, document_key, document_version, event_type)');
    expect(migration).not.toMatch(/grant\s+(select|insert|update|delete).*authenticated/i);
  });

  it('keeps legal pages public, versioned and free from placeholder sections', () => {
    const routes = read('src/pages.config.js');
    expect(routes).toContain('"termos-de-uso": TermosDeUso');
    expect(routes).toContain('"privacidade": Privacidade');
    expect(routes).toContain('"ajuda": Ajuda');
    for (const path of ['src/pages/TermosDeUso.jsx', 'src/pages/Privacidade.jsx', 'src/pages/Ajuda.jsx']) {
      const source = read(path);
      expect(source).not.toContain('EM_BREVE');
      expect(source).toContain('DOCUMENT.');
    }
  });

  it('returns no token, IP, medical data or request payload from the legal event DTO', () => {
    const source = read('supabase/functions/record-legal-event/index.ts');
    expect(source).toContain('user_id: appUser.id');
    expect(source).not.toContain('body.userId');
    expect(source).toContain('ignoreDuplicates: true');
    const responseStart = source.indexOf('return successResponse({');
    const responseEnd = source.indexOf('}, requestId', responseStart);
    const dto = source.slice(responseStart, responseEnd);
    expect(dto).not.toMatch(/token|authorization|ip|prontuario|diagnostico|payload/i);
  });
});
