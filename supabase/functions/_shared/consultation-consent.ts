import { AppError } from './errors.ts';
import { getLegalDocument } from './legal-documents.ts';
import type { SupabaseClient } from './supabase.ts';

export const CONSULTATION_CONSENT_KEYS = [
  'telemedicine_consent',
  'consultation_transcription_consent',
  'ai_assistance_notice',
] as const;

export type ConsultationConsentKey = typeof CONSULTATION_CONSENT_KEYS[number];
export type ConsultationConsentDecision = 'granted' | 'declined' | 'revoked' | 'acknowledged';

export type ConsultationConsentEventRow = {
  id: string;
  consulta_id: string;
  patient_user_id: string;
  consent_key: ConsultationConsentKey;
  document_version: string;
  decision: ConsultationConsentDecision;
  occurred_at: string;
  source: string;
  idempotency_key: string;
  created_at: string;
};

export type ConsultationConsentItem = {
  key: ConsultationConsentKey;
  title: string;
  version: string;
  effectiveDate: string;
  required: boolean;
  decision: ConsultationConsentDecision | null;
  eventVersion: string | null;
  occurredAt: string | null;
  isCurrentVersion: boolean;
  granted: boolean;
};

export type ConsultationConsentState = {
  telemedicine: ConsultationConsentItem;
  transcription: ConsultationConsentItem;
  aiAssistance: ConsultationConsentItem;
  transcriptionAllowed: boolean;
  aiAssistanceAllowed: boolean;
};

const STATE_KEYS: Array<{
  outputKey: 'telemedicine' | 'transcription' | 'aiAssistance';
  consentKey: ConsultationConsentKey;
}> = [
  { outputKey: 'telemedicine', consentKey: 'telemedicine_consent' },
  { outputKey: 'transcription', consentKey: 'consultation_transcription_consent' },
  { outputKey: 'aiAssistance', consentKey: 'ai_assistance_notice' },
];

function buildConsentItem(
  key: ConsultationConsentKey,
  event: ConsultationConsentEventRow | null,
): ConsultationConsentItem {
  const document = getLegalDocument(key);

  if (!document) {
    throw new AppError({
      status: 500,
      code: 'CONSULTATION_CONSENT_CONFIG_INVALID',
      message: 'Consultation consent configuration is invalid.',
    });
  }

  const isCurrentVersion = event?.document_version === document.version;

  return {
    key,
    title: document.title,
    version: document.version,
    effectiveDate: document.effectiveDate,
    required: document.requiresAcceptance,
    decision: event?.decision || null,
    eventVersion: event?.document_version || null,
    occurredAt: event?.occurred_at || null,
    isCurrentVersion,
    granted: isCurrentVersion && event?.decision === 'granted',
  };
}

export async function loadConsultationConsentState(
  client: SupabaseClient,
  params: { consultationId: string; patientUserId: string },
): Promise<ConsultationConsentState> {
  const { data, error } = await client
    .from('consultation_consent_events')
    .select('id, consulta_id, patient_user_id, consent_key, document_version, decision, occurred_at, source, idempotency_key, created_at')
    .eq('consulta_id', params.consultationId)
    .eq('patient_user_id', params.patientUserId)
    .in('consent_key', [...CONSULTATION_CONSENT_KEYS])
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError({
      status: 500,
      code: 'CONSULTATION_CONSENT_LOOKUP_FAILED',
      message: 'Unable to load consultation consent state.',
    });
  }

  const latestByKey = new Map<ConsultationConsentKey, ConsultationConsentEventRow>();
  for (const row of (data || []) as ConsultationConsentEventRow[]) {
    if (!latestByKey.has(row.consent_key)) latestByKey.set(row.consent_key, row);
  }

  const items = Object.fromEntries(STATE_KEYS.map(({ outputKey, consentKey }) => [
    outputKey,
    buildConsentItem(consentKey, latestByKey.get(consentKey) || null),
  ])) as Pick<ConsultationConsentState, 'telemedicine' | 'transcription' | 'aiAssistance'>;

  const transcriptionAllowed = items.transcription.granted;
  const aiAssistanceAllowed = transcriptionAllowed
    && items.aiAssistance.isCurrentVersion
    && items.aiAssistance.decision === 'acknowledged';

  return {
    ...items,
    transcriptionAllowed,
    aiAssistanceAllowed,
  };
}

export async function requireTelemedicineConsent(
  client: SupabaseClient,
  params: { consultationId: string; patientUserId: string },
) {
  const state = await loadConsultationConsentState(client, params);
  if (!state.telemedicine.granted) {
    throw new AppError({
      status: 409,
      code: 'TELEMEDICINE_CONSENT_REQUIRED',
      message: 'Patient telemedicine authorization is required for this consultation.',
    });
  }
  return state;
}

export async function requireTranscriptionConsent(
  client: SupabaseClient,
  params: { consultationId: string; patientUserId: string; requireAiNotice?: boolean },
) {
  const state = await requireTelemedicineConsent(client, params);
  if (!state.transcriptionAllowed) {
    throw new AppError({
      status: 409,
      code: 'TRANSCRIPTION_CONSENT_REQUIRED',
      message: 'Current patient transcription authorization is required.',
    });
  }
  if (params.requireAiNotice && !state.aiAssistanceAllowed) {
    throw new AppError({
      status: 409,
      code: 'AI_ASSISTANCE_NOTICE_REQUIRED',
      message: 'Current AI assistance notice acknowledgement is required.',
    });
  }
  return state;
}
