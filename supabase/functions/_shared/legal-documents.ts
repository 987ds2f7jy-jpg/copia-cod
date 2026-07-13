export const LEGAL_DOCUMENTS = {
  terms_of_use: {
    key: 'terms_of_use',
    title: 'Termos de Uso',
    version: '1.0.0',
    effectiveDate: '2026-07-12',
    lastUpdated: '2026-07-12',
    route: '/termos-de-uso',
    requiresAcceptance: true,
    allowedEvent: 'accepted',
    audiences: ['patient', 'professional'],
  },
  privacy_notice: {
    key: 'privacy_notice',
    title: 'Aviso de Privacidade',
    version: '1.0.0',
    effectiveDate: '2026-07-12',
    lastUpdated: '2026-07-12',
    route: '/privacidade',
    requiresAcceptance: false,
    allowedEvent: 'acknowledged',
    audiences: ['patient', 'professional'],
  },
  help_center: {
    key: 'help_center',
    title: 'Central de Ajuda',
    version: '1.0.0',
    effectiveDate: '2026-07-12',
    lastUpdated: '2026-07-12',
    route: '/ajuda',
    requiresAcceptance: false,
    allowedEvent: null,
    audiences: ['public'],
  },
  telemedicine_consent: {
    key: 'telemedicine_consent',
    title: 'Autorização para atendimento por telemedicina',
    version: '1.0.0',
    effectiveDate: '2026-07-12',
    lastUpdated: '2026-07-12',
    route: null,
    presentation: 'consultation_entry',
    purpose: 'Autorizar atendimento remoto e a transmissão necessária de imagem, áudio e dados para uma consulta específica.',
    requiresAcceptance: true,
    allowedEvent: null,
    allowedEvents: ['granted'],
    audiences: ['patient'],
  },
  consultation_transcription_consent: {
    key: 'consultation_transcription_consent',
    title: 'Transcrição para apoio ao atendimento',
    version: '1.0.0',
    effectiveDate: '2026-07-12',
    lastUpdated: '2026-07-12',
    route: null,
    presentation: 'consultation_entry_and_session',
    purpose: 'Autorizar o processamento temporário do áudio para gerar texto de apoio ao profissional.',
    requiresAcceptance: false,
    allowedEvent: null,
    allowedEvents: ['granted', 'declined', 'revoked'],
    audiences: ['patient'],
  },
  ai_assistance_notice: {
    key: 'ai_assistance_notice',
    title: 'Aviso de assistência por inteligência artificial',
    version: '1.0.0',
    effectiveDate: '2026-07-12',
    lastUpdated: '2026-07-12',
    route: null,
    presentation: 'consultation_entry_and_session',
    purpose: 'Informar o uso de IA para organizar um rascunho que deve ser revisado pelo profissional.',
    requiresAcceptance: false,
    allowedEvent: null,
    allowedEvents: ['acknowledged'],
    audiences: ['patient'],
  },
} as const;

export type LegalDocumentKey = keyof typeof LEGAL_DOCUMENTS;
export type LegalEventType = 'accepted' | 'acknowledged' | 'granted' | 'declined' | 'revoked';

export const SIGNUP_LEGAL_EVENTS = [
  {
    documentKey: 'terms_of_use',
    eventType: 'accepted',
  },
  {
    documentKey: 'privacy_notice',
    eventType: 'acknowledged',
  },
] as const;

export function getLegalDocument(documentKey: string) {
  return Object.prototype.hasOwnProperty.call(LEGAL_DOCUMENTS, documentKey)
    ? LEGAL_DOCUMENTS[documentKey as LegalDocumentKey]
    : null;
}
