import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';
import type { CreatedPaymentCharge } from '../_shared/payments/types.ts';
import type { ResolveServicePricingInput, ResolvedServicePricing } from '../_shared/pricing/types.ts';

export type CreateAppointmentInput = {
  professionalProfileId: string | null;
  specialty: string;
  date: string;
  time: string;
  symptoms: string;
  priority: boolean;
  fundingSource: FundingSource;
};

export type FundingSource = 'self_pay' | 'plan';

export type CoverageStatus =
  | 'plan_pending_use'
  | 'plan_used'
  | 'plan_use_failed'
  | 'plan_canceled'
  | null;

export type PlanCoverageVerification = {
  covered: true;
  reason: 'plan_credit_available';
  specialtyCode: string;
  planSubscriptionOrderId: string;
  plansServiceSubscriptionId: string | null;
  externalSubscriptionId: string | number | null;
  externalSubscriptionScoreId: string;
  externalScoreId: string | number | null;
  externalPlanId: number | null;
  externalSpecializationId: number;
  rawStatus: string | number | null;
  requestSnapshot: Record<string, unknown>;
  responseSnapshot: Record<string, unknown>;
};

export type AppUserRecord = {
  id: string;
  authUserId: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
};

export type ProfessionalTargetRecord = {
  profileId: string;
  appUserId: string | null;
  fullName: string;
  specialty: string;
  status: string;
  priceStandard: number;
  pricePriority: number;
  availableHours: string[];
  source: 'professional_profiles';
};

export type AvailabilitySlotRecord = {
  weekday: number;
  timeSlot: string;
};

export type AppointmentRecord = {
  id: string;
  patient_id: string;
  patient_name: string | null;
  patient_email: string | null;
  professional_id: string | null;
  professional_name: string | null;
  specialty: string | null;
  appointment_type: string | null;
  scheduled_datetime: string | null;
  date: string | null;
  time: string | null;
  status: string | null;
  price: number | null;
  service_code: string | null;
  price_source: string | null;
  gross_price: number | null;
  platform_fee_percent: number | null;
  platform_fee_amount: number | null;
  professional_net_amount: number | null;
  pricing_rule_id: string | null;
  fee_rule_id: string | null;
  payment_status: string | null;
  payment_required: boolean | null;
  current_payment_charge_id: string | null;
  funding_source: FundingSource | null;
  coverage_status: CoverageStatus;
  plan_credit_usage_id: string | null;
  plan_subscription_order_id: string | null;
  external_subscription_score_id: string | null;
  external_score_id: string | null;
  external_plan_id: number | null;
  external_specialization_id: number | null;
  coverage_snapshot: Record<string, unknown> | null;
  symptoms: string | null;
  accepted_at: string | null;
  consulta_id: string | null;
  payment?: CreatedPaymentCharge;
};

export type CreateAppointmentResult = {
  appointment: {
    id: string;
    status: string;
    appointmentType: string;
    scheduledDatetime: string;
    date: string;
    time: string;
    specialty: string;
    professionalId: string | null;
    professionalName: string;
    price: number;
    paymentStatus: string;
    paymentRequired: boolean;
    currentPaymentChargeId: string | null;
    fundingSource: FundingSource;
    coverageStatus: CoverageStatus;
    planCreditUsageId: string | null;
    planSubscriptionOrderId: string | null;
    externalSubscriptionScoreId: string | null;
    externalScoreId: string | null;
    externalPlanId: number | null;
    externalSpecializationId: number | null;
  };
  payment: CreatedPaymentCharge | null;
};

export type CreateAppointmentSuccessResponse = ApiSuccess<CreateAppointmentResult>;
export type ErrorResponse = ApiErrorResponse;

export type CreateAppointmentRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  findProfessionalTargetById(profileId: string): Promise<ProfessionalTargetRecord | null>;
  resolveServicePricing(input: ResolveServicePricingInput): Promise<ResolvedServicePricing>;
  listAvailabilitySlots(profileId: string): Promise<AvailabilitySlotRecord[]>;
  hasActiveAppointmentConflict(params: {
    professionalId: string;
    scheduledDatetime: string;
  }): Promise<boolean>;
  verifyPlanCoverageForSpecialty(params: {
    appUserId: string;
    fallbackExternalKey: string;
    specialtyCode: string;
  }): Promise<PlanCoverageVerification>;
  createAppointment(params: {
    patientId: string;
    patientName: string;
    patientEmail: string;
    professionalId: string | null;
    professionalName: string;
    specialty: string;
    appointmentType: string;
    scheduledDatetime: string;
    date: string;
    time: string;
    status: string;
    price: number;
    pricing: ResolvedServicePricing;
    symptoms: string;
    fundingSource: FundingSource;
    planCoverage: PlanCoverageVerification | null;
  }): Promise<AppointmentRecord>;
};

export type CreateAppointmentCommand = {
  requestId: string;
  input: CreateAppointmentInput;
  authenticatedUser: AuthenticatedUser;
};
