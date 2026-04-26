import { AppError } from '../errors.ts';
import type { SupabaseClient } from '../supabase.ts';
import {
  getFeeGroupForServiceCode,
  getPriceSourceForServiceCode,
  normalizePricingSpecialty,
  PROFILE_PRIORITY_SERVICE_CODE,
  PROFILE_STANDARD_SERVICE_CODE,
  SPECIALTY_REQUEST_SERVICE_CODE,
} from './service-codes.ts';
import type {
  FeeGroup,
  ResolveServicePricingInput,
  ResolvedServicePricing,
  ServiceCode,
} from './types.ts';

type ProfessionalPriceRow = {
  id: string;
  price_standard: number | null;
  price_priority: number | null;
};

type PlatformPriceRow = {
  id: string;
  service_code: string;
  specialty_code: string | null;
  fee_group: string;
  gross_price: number | string | null;
  effective_from: string | null;
  effective_to: string | null;
};

type FeeRuleRow = {
  id: string;
  fee_group: string;
  service_code: string | null;
  fee_percent: number | string | null;
  effective_from: string | null;
  effective_to: string | null;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseMoney(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? roundMoney(parsed) : 0;
}

function isCurrentlyEffective(
  row: { effective_from: string | null; effective_to: string | null },
  now: Date,
) {
  const startsAt = row.effective_from ? new Date(row.effective_from) : null;
  const endsAt = row.effective_to ? new Date(row.effective_to) : null;

  if (startsAt && startsAt.getTime() > now.getTime()) {
    return false;
  }

  if (endsAt && endsAt.getTime() <= now.getTime()) {
    return false;
  }

  return true;
}

async function resolveProfessionalGrossPrice(
  client: SupabaseClient,
  serviceCode: ServiceCode,
  professionalProfileId: string | null | undefined,
) {
  if (!professionalProfileId) {
    throw new AppError({
      status: 400,
      code: 'PROFESSIONAL_PROFILE_REQUIRED_FOR_PRICING',
      message: 'Professional profile is required to resolve profile service pricing.',
      details: { serviceCode },
    });
  }

  const { data, error } = await client
    .from('professional_profiles')
    .select('id, price_standard, price_priority')
    .eq('id', professionalProfileId)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PROFESSIONAL_PRICING_LOOKUP_FAILED',
      message: 'Unable to load professional pricing.',
      details: error.message,
    });
  }

  const row = data as ProfessionalPriceRow | null;

  if (!row?.id) {
    throw new AppError({
      status: 404,
      code: 'PROFESSIONAL_PROFILE_NOT_FOUND_FOR_PRICING',
      message: 'Professional profile was not found for pricing resolution.',
      details: { professionalProfileId, serviceCode },
    });
  }

  const grossPrice = serviceCode === PROFILE_PRIORITY_SERVICE_CODE
    ? parseMoney(row.price_priority)
    : parseMoney(row.price_standard);

  if (grossPrice <= 0) {
    throw new AppError({
      status: 422,
      code: 'PROFESSIONAL_PRICE_NOT_CONFIGURED',
      message: 'Professional price must be configured before creating this appointment.',
      details: { professionalProfileId, serviceCode },
    });
  }

  return grossPrice;
}

function resolveSpecialtyCodeForPricing(input: ResolveServicePricingInput) {
  const specialtyCode = normalizePricingSpecialty(input.specialtyCode || input.specialty || '');

  if (!specialtyCode) {
    throw new AppError({
      status: 422,
      code: 'SPECIALTY_CODE_REQUIRED_FOR_PRICING',
      message: 'Specialty is required to resolve specialty appointment pricing.',
      details: { serviceCode: input.serviceCode },
    });
  }

  return specialtyCode;
}

async function resolvePlatformPrice(
  client: SupabaseClient,
  serviceCode: ServiceCode,
  input: ResolveServicePricingInput,
) {
  const now = new Date();
  let query = client
    .from('platform_service_prices')
    .select('id, service_code, specialty_code, fee_group, gross_price, effective_from, effective_to')
    .eq('service_code', serviceCode)
    .eq('active', true)
    .lte('effective_from', now.toISOString())
    .order('effective_from', { ascending: false });

  const specialtyCode = serviceCode === SPECIALTY_REQUEST_SERVICE_CODE
    ? resolveSpecialtyCodeForPricing(input)
    : '';

  query = query.eq('specialty_code', specialtyCode);

  const { data, error } = await query;

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PLATFORM_PRICE_LOOKUP_FAILED',
      message: 'Unable to load platform service price.',
      details: error.message,
    });
  }

  const row = ((data || []) as PlatformPriceRow[]).find((candidate) =>
    isCurrentlyEffective(candidate, now)
  );

  if (!row?.id) {
    throw new AppError({
      status: 409,
      code: 'PLATFORM_PRICE_NOT_CONFIGURED',
      message: 'Platform price is not configured for this service.',
      details: { serviceCode, specialtyCode },
    });
  }

  const grossPrice = parseMoney(row.gross_price);

  if (grossPrice <= 0) {
    throw new AppError({
      status: 409,
      code: 'PLATFORM_PRICE_NOT_CONFIGURED',
      message: 'Platform price must be greater than zero for this service.',
      details: { serviceCode, specialtyCode, pricingRuleId: row.id },
    });
  }

  if (serviceCode === SPECIALTY_REQUEST_SERVICE_CODE) {
    console.log('[pricing] specialty_request resolved', {
      serviceCode,
      specialtyCode,
      grossPrice,
      pricingRuleId: row.id,
    });
  }

  return {
    grossPrice,
    pricingRuleId: row.id,
  };
}

function pickFeeRule(rows: FeeRuleRow[], serviceCode: ServiceCode, now: Date) {
  return rows
    .filter((row) => isCurrentlyEffective(row, now))
    .sort((a, b) => {
      const aSpecificity = a.service_code === serviceCode ? 1 : 0;
      const bSpecificity = b.service_code === serviceCode ? 1 : 0;

      if (aSpecificity !== bSpecificity) {
        return bSpecificity - aSpecificity;
      }

      return new Date(b.effective_from || 0).getTime() - new Date(a.effective_from || 0).getTime();
    })[0] || null;
}

async function resolveFeeRule(client: SupabaseClient, feeGroup: FeeGroup, serviceCode: ServiceCode) {
  const now = new Date();
  const { data, error } = await client
    .from('platform_fee_rules')
    .select('id, fee_group, service_code, fee_percent, effective_from, effective_to')
    .eq('fee_group', feeGroup)
    .eq('active', true)
    .lte('effective_from', now.toISOString());

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PLATFORM_FEE_RULE_LOOKUP_FAILED',
      message: 'Unable to load platform fee rule.',
      details: error.message,
    });
  }

  const candidates = ((data || []) as FeeRuleRow[]).filter((row) =>
    !row.service_code || row.service_code === serviceCode
  );
  const row = pickFeeRule(candidates, serviceCode, now);

  if (!row?.id) {
    throw new AppError({
      status: 409,
      code: 'PLATFORM_FEE_RULE_NOT_CONFIGURED',
      message: 'Platform fee rule is not configured for this service.',
      details: { feeGroup, serviceCode },
    });
  }

  return {
    feeRuleId: row.id,
    platformFeePercent: Number(row.fee_percent ?? 0),
  };
}

export async function resolveServicePricing(
  client: SupabaseClient,
  input: ResolveServicePricingInput,
): Promise<ResolvedServicePricing> {
  const serviceCode = input.serviceCode;
  const feeGroup = getFeeGroupForServiceCode(serviceCode);
  const priceSource = getPriceSourceForServiceCode(serviceCode);

  const priceResult = priceSource === 'professional_profile'
    ? {
      grossPrice: await resolveProfessionalGrossPrice(
        client,
        serviceCode,
        input.professionalProfileId,
      ),
      pricingRuleId: null,
    }
    : await resolvePlatformPrice(client, serviceCode, input);

  if (
    priceSource === 'professional_profile' &&
    serviceCode !== PROFILE_STANDARD_SERVICE_CODE &&
    serviceCode !== PROFILE_PRIORITY_SERVICE_CODE
  ) {
    throw new AppError({
      status: 500,
      code: 'INVALID_PROFILE_SERVICE_CODE',
      message: 'Invalid profile service code for professional pricing.',
      details: { serviceCode },
    });
  }

  const feeResult = await resolveFeeRule(client, feeGroup, serviceCode);
  const platformFeeAmount = roundMoney(priceResult.grossPrice * feeResult.platformFeePercent);
  const professionalNetAmount = roundMoney(priceResult.grossPrice - platformFeeAmount);

  return {
    serviceCode,
    priceSource,
    feeGroup,
    grossPrice: priceResult.grossPrice,
    platformFeePercent: feeResult.platformFeePercent,
    platformFeeAmount,
    professionalNetAmount,
    pricingRuleId: priceResult.pricingRuleId,
    feeRuleId: feeResult.feeRuleId,
  };
}
