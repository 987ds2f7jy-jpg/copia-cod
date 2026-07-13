import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LEGAL_DOCUMENTS } from '../../supabase/functions/_shared/legal-documents';
import { loadConsultationConsentState } from '../../supabase/functions/_shared/consultation-consent';
import { startConsultaSession } from '../../supabase/functions/start-consulta-session/service';
import type { SupabaseClient } from '../../supabase/functions/_shared/supabase';
import type { StartConsultaSessionRepository } from '../../supabase/functions/start-consulta-session/types';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const consultationId = '10000000-0000-4000-8000-000000000001';
const patientId = '20000000-0000-4000-8000-000000000001';

function createConsentClient(rows: Array<Record<string, unknown>>) {
  let orderCalls = 0;
  const result = { data: rows, error: null };
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => {
      orderCalls += 1;
      return orderCalls >= 2 ? Promise.resolve(result) : query;
    },
  };
  return { from: vi.fn(() => query) } as unknown as SupabaseClient;
}

function consentRow(key: string, decision: string, version = '1.0.0') {
  return {
    id: crypto.randomUUID(),
    consulta_id: consultationId,
    patient_user_id: patientId,
    consent_key: key,
    document_version: version,
    decision,
    occurred_at: '2026-07-12T20:00:00Z',
    source: 'teleconsulta_entry',
    idempotency_key: crypto.randomUUID(),
    created_at: '2026-07-12T20:00:00Z',
  };
}

function createStartRepository(consentResult: Promise<unknown>) {
  const consultation = {
    id: consultationId,
    paciente_id: patientId,
    paciente_nome: 'Patient',
    paciente_email: null,
    profissional_id: '30000000-0000-4000-8000-000000000001',
    profissional_user_id: '40000000-0000-4000-8000-000000000001',
    profissional_nome: 'Professional',
    especialidade: 'Clinico Geral',
    tipo_consulta: 'padrao',
    status: 'aguardando',
    datetime: '2026-07-12T21:00:00Z',
    descricao_sintomas: null,
    inicio_at: null,
    fim_at: null,
    sala_id: null,
    token_sala: null,
    preco: 0,
  };
  return {
    findAppUserByAuthUserId: vi.fn().mockResolvedValue({
      id: '40000000-0000-4000-8000-000000000001',
      authUserId: 'auth-professional',
      role: 'professional',
      isActive: true,
    }),
    findConsultationById: vi.fn().mockResolvedValue(consultation),
    findProfessionalIdentityByAppUserId: vi.fn().mockResolvedValue({
      profileId: consultation.profissional_id,
      profileIds: [consultation.profissional_id],
      appUserId: consultation.profissional_user_id,
    }),
    requireTelemedicineConsent: vi.fn(() => consentResult),
    findAppointmentByConsultationId: vi.fn().mockResolvedValue({
      id: '50000000-0000-4000-8000-000000000001',
      status: 'accepted',
      payment_required: false,
      payment_status: 'not_required',
      current_payment_charge_id: null,
      gross_price: 0,
      platform_fee_percent: 0,
      platform_fee_amount: 0,
      professional_net_amount: 0,
    }),
    findQueueEntryByConsultation: vi.fn().mockResolvedValue(null),
    updateConsultationSession: vi.fn().mockImplementation(async (params) => ({
      ...consultation,
      status: params.status,
      inicio_at: params.startedAt,
      sala_id: params.roomId,
      token_sala: params.roomToken,
    })),
    updateAppointmentStatus: vi.fn().mockResolvedValue({ id: 'appointment', status: 'in_progress' }),
    updateQueueStatus: vi.fn(),
  } as unknown as StartConsultaSessionRepository;
}

describe('consultation-scoped consent state', () => {
  it('uses separate canonical documents and decisions', () => {
    expect(LEGAL_DOCUMENTS.telemedicine_consent.allowedEvents).toEqual(['granted']);
    expect(LEGAL_DOCUMENTS.consultation_transcription_consent.allowedEvents).toEqual(['granted', 'declined', 'revoked']);
    expect(LEGAL_DOCUMENTS.ai_assistance_notice.allowedEvents).toEqual(['acknowledged']);
  });

  it('keeps transcription disabled by default and after revocation', async () => {
    const empty = await loadConsultationConsentState(createConsentClient([]), {
      consultationId,
      patientUserId: patientId,
    });
    expect(empty.transcriptionAllowed).toBe(false);
    expect(empty.aiAssistanceAllowed).toBe(false);

    const revoked = await loadConsultationConsentState(createConsentClient([
      consentRow('telemedicine_consent', 'granted'),
      consentRow('consultation_transcription_consent', 'revoked'),
      consentRow('ai_assistance_notice', 'acknowledged'),
    ]), { consultationId, patientUserId: patientId });
    expect(revoked.telemedicine.granted).toBe(true);
    expect(revoked.transcriptionAllowed).toBe(false);
    expect(revoked.aiAssistanceAllowed).toBe(false);
  });

  it('requires current versions for telemedicine, transcription and AI', async () => {
    const state = await loadConsultationConsentState(createConsentClient([
      consentRow('telemedicine_consent', 'granted'),
      consentRow('consultation_transcription_consent', 'granted'),
      consentRow('ai_assistance_notice', 'acknowledged'),
    ]), { consultationId, patientUserId: patientId });
    expect(state.telemedicine.granted).toBe(true);
    expect(state.transcriptionAllowed).toBe(true);
    expect(state.aiAssistanceAllowed).toBe(true);

    const outdated = await loadConsultationConsentState(createConsentClient([
      consentRow('telemedicine_consent', 'granted', '0.9.0'),
    ]), { consultationId, patientUserId: patientId });
    expect(outdated.telemedicine.granted).toBe(false);
  });
});

describe('server-side session and provider gates', () => {
  it('does not start a consultation without patient telemedicine authorization', async () => {
    const repository = createStartRepository(Promise.reject(Object.assign(new Error('required'), {
      status: 409,
      code: 'TELEMEDICINE_CONSENT_REQUIRED',
    })));
    await expect(startConsultaSession({
      requestId: 'req-no-consent',
      input: { consultationId },
      authenticatedUser: { authUserId: 'auth-professional' },
      repository,
    })).rejects.toMatchObject({ code: 'TELEMEDICINE_CONSENT_REQUIRED' });
    expect(repository.updateConsultationSession).not.toHaveBeenCalled();
  });

  it('starts normally after valid authorization', async () => {
    const repository = createStartRepository(Promise.resolve({ telemedicine: { granted: true } }));
    const result = await startConsultaSession({
      requestId: 'req-consented',
      input: { consultationId },
      authenticatedUser: { authUserId: 'auth-professional' },
      repository,
    });
    expect(result.consultation.status).toBe('em_atendimento');
    expect(repository.updateConsultationSession).toHaveBeenCalledTimes(1);
  });

  it('gates Zoom, Deepgram and Groq without trusting the React decision', () => {
    const zoom = read('supabase/functions/zoom-token/index.ts');
    const deepgram = read('supabase/functions/deepgram-token/index.ts');
    const groq = read('supabase/functions/groq-completion/index.ts');
    expect(zoom).toContain('await requireTelemedicineConsent');
    expect(deepgram).toContain('await requireTranscriptionConsent');
    expect(deepgram).toContain('/v1/auth/grant');
    expect(deepgram).not.toContain('key: deepgramApiKey');
    expect(groq).toContain('requireAiNotice: true');
    expect(groq).toContain('ai_assistance_draft_generated');
    expect(groq).not.toMatch(/\.from\(['"]prontuarios['"]\).*\.(insert|upsert|update)/s);
  });
});

describe('immutable decision recording', () => {
  it('ignores client user, version and timestamp and rejects professional grants', () => {
    const endpoint = read('supabase/functions/record-consultation-consent/index.ts');
    expect(endpoint).toContain("allowedRoles: ['patient']");
    expect(endpoint).toContain('patient_user_id: appUser.id');
    expect(endpoint).toContain('document_version: document.version');
    expect(endpoint).not.toContain('record.patientUserId');
    expect(endpoint).not.toContain('record.documentVersion');
    expect(endpoint).not.toContain('record.occurredAt');
  });

  it('uses append-only storage, server timestamps and an idempotency constraint', () => {
    const migration = read('supabase/migrations/20260712220000_add_consultation_consent_events.sql');
    expect(migration).toContain('occurred_at timestamptz not null default now()');
    expect(migration).toContain('consultation_consent_events_idempotency_unique');
    expect(migration).toContain('force row level security');
    expect(migration).toContain('before update or delete');
    expect(migration).toContain('revoke all on table public.consultation_consent_events from public, anon, authenticated');
  });

  it('does not log or audit clinical content and does not expose the permanent Deepgram key', () => {
    const files = [
      read('supabase/functions/record-consultation-consent/index.ts'),
      read('supabase/functions/deepgram-token/index.ts'),
      read('supabase/functions/groq-completion/index.ts'),
    ];
    const consoleCalls = files.join('\n').match(/console\.(?:info|warn|error)\([\s\S]*?\);/g)?.join('\n') || '';
    expect(consoleCalls).not.toMatch(/transcript|prontuario|prompt|authorization|jwt|deepgramApiKey/i);
    expect(read('supabase/functions/deepgram-token/index.ts')).not.toContain('key: deepgramApiKey');
  });
});
