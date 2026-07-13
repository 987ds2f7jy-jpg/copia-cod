import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';
import type { CreatedPaymentCharge } from '../_shared/payments/types.ts';
import type { ResolveServicePricingInput, ResolvedServicePricing } from '../_shared/pricing/types.ts';
import type { PlanCoverageVerification } from '../_shared/plans/coverage.ts';

export type JoinQueueInput = {
  specialty: string;
  symptoms: string;
  priorityLevel: string;
  solicitacaoExameId: string;
};

export type AppUserRecord = {
  id: string;
  authUserId: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
};

export type QueueRecord = {
  id: string;
  patient_id: string;
  patient_name: string | null;
  patient_email: string | null;
  specialty: string | null;
  symptoms: string | null;
  priority_level: string | null;
  status: string | null;
  position: number | null;
  estimated_wait_time: number | null;
  assigned_professional_id: string | null;
  solicitacao_exame_id: string | null;
  service_code: string | null;
  price_source: string | null;
  quoted_gross_price: number | null;
  quoted_platform_fee_percent: number | null;
  quoted_platform_fee_amount: number | null;
  quoted_professional_net_amount: number | null;
  pricing_rule_id: string | null;
  fee_rule_id: string | null;
  payment_status: string | null;
  payment_required: boolean | null;
  current_payment_charge_id: string | null;
  paid_at: string | null;
  funding_source: 'self_pay' | 'plan' | null;
  coverage_status: string | null;
  plan_credit_usage_id: string | null;
  plan_subscription_order_id: string | null;
  external_subscription_score_id: string | null;
  external_score_id: string | null;
  external_plan_id: number | null;
  external_specialization_id: number | null;
  payment?: CreatedPaymentCharge;
};

export type SolicitacaoPaymentSnapshotRecord = {
  id: string;
  paciente_id: string;
  service_code: string | null;
  price_source: string | null;
  quoted_gross_price: number | null;
  quoted_platform_fee_percent: number | null;
  quoted_platform_fee_amount: number | null;
  quoted_professional_net_amount: number | null;
  pricing_rule_id: string | null;
  fee_rule_id: string | null;
  payment_status: string | null;
  current_payment_charge_id: string | null;
  paid_at: string | null;
};

export type PlantaoConsultaRecord = {
  id: string;
  status: string | null;
  tipo_consulta: string;
};

export type PublicProfileRecord = {
  id: string;
  specialty: string;
  status: string;
  isOnDuty: boolean;
};

export type JoinQueueResult = {
  queueEntry: {
    id: string;
    status: string;
    specialty: string;
    position: number;
    estimatedWaitTime: number;
    assignedProfessionalId: string;
    solicitacaoExameId: string;
    serviceCode: string;
    quotedGrossPrice: number;
    paymentStatus: string;
    paymentRequired: boolean;
    currentPaymentChargeId: string | null;
    fundingSource: 'self_pay' | 'plan';
    coverageStatus: string | null;
    planCreditUsageId: string | null;
  };
  payment: CreatedPaymentCharge | null;
  reusedExisting: boolean;
};

export type JoinQueueSuccessResponse = ApiSuccess<JoinQueueResult>;
export type ErrorResponse = ApiErrorResponse;

export type JoinQueueRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  findActivePlantaoConsultaByPatientId(patientId: string): Promise<PlantaoConsultaRecord | null>;
  findCurrentActiveQueueEntry(patientId: string): Promise<QueueRecord | null>;
  findSolicitacaoPaymentSnapshot(params: {
    solicitacaoExameId: string;
    patientId: string;
  }): Promise<SolicitacaoPaymentSnapshotRecord | null>;
  listOnDutyPublicProfiles(): Promise<PublicProfileRecord[]>;
  resolveServicePricing(input: ResolveServicePricingInput): Promise<ResolvedServicePricing>;
  resolvePlanCoverage(params: {
    appUserId: string;
    fallbackExternalKey: string;
    specialtyCode: string;
  }): Promise<PlanCoverageVerification | null>;
  countWaitingQueueBySpecialty(specialty: string): Promise<number>;
  createQueueEntry(params: {
    patientId: string;
    patientName: string;
    patientEmail: string;
    specialty: string;
    symptoms: string;
    priorityLevel: string;
    position: number;
    estimatedWaitTime: number;
    solicitacaoExameId: string;
    pricing: ResolvedServicePricing;
    linkedPaidPayment?: {
      currentPaymentChargeId: string;
      paidAt: string | null;
    } | null;
    planCoverage?: PlanCoverageVerification | null;
  }): Promise<QueueRecord>;
};

export type JoinQueueCommand = {
  requestId: string;
  input: JoinQueueInput;
  authenticatedUser: AuthenticatedUser;
};
