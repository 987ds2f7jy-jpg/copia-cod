export type ProfileServiceCode = 'profile_standard' | 'profile_priority';

export type PlatformServiceCode =
  | 'on_duty_clinico_geral'
  | 'on_duty_pediatria'
  | 'on_duty_psicologia'
  | 'on_duty_psiquiatria'
  | 'specialty_request'
  | 'extra_checkup'
  | 'extra_exames_especificos'
  | 'extra_renovacao_receitas'
  | 'extra_laudo_medico';

export type ServiceCode = ProfileServiceCode | PlatformServiceCode;

export type FeeGroup = 'profile' | 'duty' | 'specialty' | 'services';

export type PriceSource = 'professional_profile' | 'platform_fixed';

export type PaymentStatus =
  | 'payment_pending'
  | 'payment_processing'
  | 'paid'
  | 'payment_failed'
  | 'payment_expired'
  | 'refunded'
  | 'chargeback';

export type ResolveServicePricingInput = {
  serviceCode: ServiceCode;
  professionalProfileId?: string | null;
  specialty?: string | null;
  specialtyCode?: string | null;
};

export type ResolvedServicePricing = {
  serviceCode: ServiceCode;
  priceSource: PriceSource;
  feeGroup: FeeGroup;
  grossPrice: number;
  platformFeePercent: number;
  platformFeeAmount: number;
  professionalNetAmount: number;
  pricingRuleId: string | null;
  feeRuleId: string | null;
};
