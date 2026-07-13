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
} as const;

export type LegalDocumentKey = keyof typeof LEGAL_DOCUMENTS;
export type LegalEventType = 'accepted' | 'acknowledged' | 'revoked';

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
