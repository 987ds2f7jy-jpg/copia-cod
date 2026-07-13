// ============================================================
// Configuração centralizada de dados legais e empresariais (frontend).
// Não espalhe estes valores diretamente pelos componentes:
// importe deste arquivo. Valores contendo "(ADICIONAR" são
// placeholders e devem ser substituídos por dados reais.
// ============================================================

import { LEGAL_DOCUMENTS } from '../../supabase/functions/_shared/legal-documents';

export { LEGAL_DOCUMENTS };

export const legalConfig = {
  brandName: 'Rápido Doutor',
  legalName: '(ADICIONAR RAZÃO SOCIAL)',
  cnpj: '(ADICIONAR CNPJ)',
  companyAddress: '(ADICIONAR ENDEREÇO)',
  companyCityState: '(ADICIONAR CIDADE E ESTADO)',
  supportEmail: '(ADICIONAR E-MAIL)',
  privacyEmail: '(ADICIONAR CONTATO)',
  professionalSupportEmail: '(ADICIONAR E-MAIL)',
  phone: '(ADICIONAR TELEFONE)',
  dpoName: '(ADICIONAR CONTATO)',
  medicalDirectorName: '(ADICIONAR RESPONSÁVEL TÉCNICO)',
  medicalDirectorCrm: '(VALIDAR E ADICIONAR, SE APLICÁVEL)',
  companyCrm: '(VALIDAR E ADICIONAR, SE APLICÁVEL)',
  cancellationDeadline: '(VALIDAR REGRA COMERCIAL)',
  patientDelayTolerance: '(VALIDAR REGRA COMERCIAL)',
  professionalDelayTolerance: '(VALIDAR REGRA COMERCIAL)',
  refundDeadline: '(VALIDAR REGRA COMERCIAL)',
  privacyResponseDeadline: '(VALIDAR PROCEDIMENTO INTERNO)',
  dpaUrl: '(VALIDAR E ADICIONAR, SE APLICÁVEL)',
} as const;

export type LegalConfig = typeof legalConfig;

/**
 * Retorna true quando o valor ainda é um placeholder ("(ADICIONAR...").
 * Uso apenas frontend — não envia dados, não cria telemetria nem rede.
 */
export function isLegalPlaceholder(value: unknown): boolean {
  return typeof value === 'string' && value.includes('(ADICIONAR');
}

/**
 * Aviso apenas em desenvolvimento sobre valores ainda pendentes.
 * Não exibe nada ao usuário final e não faz chamadas de rede.
 */
export function warnLegalPlaceholders(): void {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    const pending = Object.entries(legalConfig)
      .filter(([, v]) => isLegalPlaceholder(v))
      .map(([k]) => k);
    if (pending.length > 0) {
      console.warn(
        `[legalConfig] Valores pendentes de preenchimento: ${pending.join(', ')}`,
      );
    }
  }
}

/** Rotas públicas das páginas legais/suporte. */
export const legalRoutes = {
  ajuda: LEGAL_DOCUMENTS.help_center.route,
  termos: LEGAL_DOCUMENTS.terms_of_use.route,
  privacidade: LEGAL_DOCUMENTS.privacy_notice.route,
} as const;
