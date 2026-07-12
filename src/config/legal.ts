// ============================================================
// Configuração centralizada de dados legais (frontend).
// Não espalhe estes valores diretamente pelos componentes:
// importe deste arquivo. Valores contendo "(ADICIONAR" são
// placeholders e devem ser substituídos por dados reais.
// ============================================================

export const legalConfig = {
  brandName: 'Rápido Doutor',
  legalName: '(ADICIONAR RAZÃO SOCIAL)',
  cnpj: '(ADICIONAR CNPJ)',
  companyAddress: '(ADICIONAR ENDEREÇO COMPLETO)',
  companyCityState: '(ADICIONAR CIDADE E ESTADO)',
  supportEmail: '(ADICIONAR EMAIL DE SUPORTE)',
  privacyEmail: '(ADICIONAR EMAIL DE PRIVACIDADE)',
  professionalSupportEmail: '(ADICIONAR EMAIL DE SUPORTE AOS PROFISSIONAIS)',
  phone: '(ADICIONAR TELEFONE)',
  dpoName: '(ADICIONAR NOME DO ENCARREGADO DE DADOS)',
  medicalDirectorName: '(ADICIONAR NOME DO DIRETOR TÉCNICO)',
  medicalDirectorCrm: '(ADICIONAR CRM DO DIRETOR TÉCNICO)',
  companyCrm: '(ADICIONAR REGISTRO DA EMPRESA NO CRM)',
  termsVersion: '1.0',
  privacyVersion: '1.0',
  helpVersion: '1.0',
  lastUpdated: '(ADICIONAR DATA DA ÚLTIMA ATUALIZAÇÃO)',
  effectiveDate: '(ADICIONAR DATA DE VIGÊNCIA)',
  cancellationDeadline: '(ADICIONAR PRAZO DE CANCELAMENTO SEM CUSTO)',
  patientDelayTolerance: '(ADICIONAR TOLERÂNCIA PARA ATRASO DO PACIENTE)',
  professionalDelayTolerance: '(ADICIONAR TOLERÂNCIA PARA ATRASO DO PROFISSIONAL)',
  refundDeadline: '(ADICIONAR PRAZO ESTIMADO PARA ESTORNO)',
  privacyResponseDeadline: '(ADICIONAR PRAZO INTERNO DE RESPOSTA)',
  dpaUrl: '(ADICIONAR LINK DO ACORDO DE TRATAMENTO DE DADOS)',
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
  ajuda: '/ajuda',
  termos: '/termos-de-uso',
  privacidade: '/privacidade',
} as const;
