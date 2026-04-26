import type { FeeGroup, PriceSource, ServiceCode } from './types.ts';

export const PROFILE_STANDARD_SERVICE_CODE = 'profile_standard';
export const PROFILE_PRIORITY_SERVICE_CODE = 'profile_priority';
export const SPECIALTY_REQUEST_SERVICE_CODE = 'specialty_request';

const DUTY_SERVICE_BY_SPECIALTY: Record<string, ServiceCode> = {
  clinico_geral: 'on_duty_clinico_geral',
  pediatria: 'on_duty_pediatria',
  psicologia: 'on_duty_psicologia',
  psiquiatria: 'on_duty_psiquiatria',
};

const EXTRA_SERVICE_BY_TYPE: Record<string, ServiceCode> = {
  checkup: 'extra_checkup',
  especificos: 'extra_exames_especificos',
  renovacao_receitas: 'extra_renovacao_receitas',
  laudo_medico: 'extra_laudo_medico',
};

export const FEE_GROUP_BY_SERVICE_CODE: Record<ServiceCode, FeeGroup> = {
  profile_standard: 'profile',
  profile_priority: 'profile',
  on_duty_clinico_geral: 'duty',
  on_duty_pediatria: 'duty',
  on_duty_psicologia: 'duty',
  on_duty_psiquiatria: 'duty',
  specialty_request: 'specialty',
  extra_checkup: 'services',
  extra_exames_especificos: 'services',
  extra_renovacao_receitas: 'services',
  extra_laudo_medico: 'services',
};

const PRICE_SOURCE_BY_SERVICE_CODE: Record<ServiceCode, PriceSource> = {
  profile_standard: 'professional_profile',
  profile_priority: 'professional_profile',
  on_duty_clinico_geral: 'platform_fixed',
  on_duty_pediatria: 'platform_fixed',
  on_duty_psicologia: 'platform_fixed',
  on_duty_psiquiatria: 'platform_fixed',
  specialty_request: 'platform_fixed',
  extra_checkup: 'platform_fixed',
  extra_exames_especificos: 'platform_fixed',
  extra_renovacao_receitas: 'platform_fixed',
  extra_laudo_medico: 'platform_fixed',
};

const SPECIALTY_ALIASES: Record<string, string> = {
  psicologia_clinica: 'psicologia',
  nutricao_clinica: 'nutricao',
  fonoaudiologia_clinica: 'fonoaudiologia',
};

export function getFeeGroupForServiceCode(serviceCode: ServiceCode): FeeGroup {
  return FEE_GROUP_BY_SERVICE_CODE[serviceCode];
}

export function getPriceSourceForServiceCode(serviceCode: ServiceCode): PriceSource {
  return PRICE_SOURCE_BY_SERVICE_CODE[serviceCode];
}

export function normalizePricingSpecialty(value: string) {
  const normalized = (value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

  return SPECIALTY_ALIASES[normalized] || normalized;
}

export function getOnDutyServiceCodeForSpecialty(specialty: string): ServiceCode | null {
  return DUTY_SERVICE_BY_SPECIALTY[normalizePricingSpecialty(specialty)] || null;
}

export function getSolicitacaoExameServiceCode(tipo: string): ServiceCode | null {
  return EXTRA_SERVICE_BY_TYPE[tipo] || null;
}
