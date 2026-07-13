import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createAppointment } from '../../supabase/functions/create-appointment/service';
import { acceptQueueEntry } from '../../supabase/functions/accept-queue-entry/service';
import { joinQueue } from '../../supabase/functions/join-queue/service';
import type { CreateAppointmentRepository } from '../../supabase/functions/create-appointment/types';
import type { AcceptQueueEntryRepository } from '../../supabase/functions/accept-queue-entry/types';
import type { JoinQueueRepository } from '../../supabase/functions/join-queue/types';

const patientId = '10000000-0000-4000-8000-000000000001';
const professionalId = '20000000-0000-4000-8000-000000000001';
const usageId = '30000000-0000-4000-8000-000000000001';

function futureDate(days = 4) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

const coverage = {
  covered: true as const,
  reason: 'plan_credit_available' as const,
  specialtyCode: 'clinico_geral',
  planSubscriptionOrderId: '40000000-0000-4000-8000-000000000001',
  plansServiceSubscriptionId: '7',
  externalSubscriptionId: 7,
  externalSubscriptionScoreId: '156',
  externalScoreId: 10,
  externalPlanId: 2,
  externalSpecializationId: 2,
  rawStatus: 1,
  requestSnapshot: { flow: 'appointment_specialty' },
  responseSnapshot: { external_subscription_score_id: '156' },
};

function appointmentRepository(planCoverage: typeof coverage | null) {
  const createRecord = vi.fn(async (params) => ({
    id: '50000000-0000-4000-8000-000000000001',
    patient_id: params.patientId,
    patient_name: params.patientName,
    patient_email: params.patientEmail,
    professional_id: null,
    professional_name: '',
    specialty: params.specialty,
    appointment_type: params.appointmentType,
    scheduled_datetime: params.scheduledDatetime,
    date: params.date,
    time: params.time,
    status: params.status,
    price: params.price,
    service_code: params.pricing.serviceCode,
    price_source: params.pricing.priceSource,
    gross_price: params.pricing.grossPrice,
    platform_fee_percent: params.pricing.platformFeePercent,
    platform_fee_amount: params.pricing.platformFeeAmount,
    professional_net_amount: params.pricing.professionalNetAmount,
    pricing_rule_id: params.pricing.pricingRuleId,
    fee_rule_id: params.pricing.feeRuleId,
    payment_status: 'payment_pending',
    payment_required: params.fundingSource !== 'plan',
    current_payment_charge_id: params.fundingSource === 'plan' ? null : 'charge-id',
    funding_source: params.fundingSource,
    coverage_status: params.fundingSource === 'plan' ? 'plan_pending_use' : null,
    plan_credit_usage_id: params.fundingSource === 'plan' ? usageId : null,
    plan_subscription_order_id: params.planCoverage?.planSubscriptionOrderId || null,
    external_subscription_score_id: params.planCoverage?.externalSubscriptionScoreId || null,
    external_score_id: params.planCoverage?.externalScoreId || null,
    external_plan_id: params.planCoverage?.externalPlanId || null,
    external_specialization_id: params.planCoverage?.externalSpecializationId || null,
    coverage_snapshot: {},
    symptoms: params.symptoms,
    accepted_at: null,
    consulta_id: null,
  }));

  return {
    repository: {
      findAppUserByAuthUserId: vi.fn().mockResolvedValue({
        id: patientId,
        authUserId: 'auth-patient',
        fullName: 'Patient Test',
        email: 'patient@example.invalid',
        role: 'patient',
        isActive: true,
      }),
      findProfessionalTargetById: vi.fn(),
      resolveServicePricing: vi.fn().mockResolvedValue({
        serviceCode: 'specialty_request',
        priceSource: 'platform_fixed',
        grossPrice: 100,
        platformFeePercent: 0.1,
        platformFeeAmount: 10,
        professionalNetAmount: 90,
        pricingRuleId: '60000000-0000-4000-8000-000000000001',
        feeRuleId: '70000000-0000-4000-8000-000000000001',
      }),
      listAvailabilitySlots: vi.fn(),
      hasActiveAppointmentConflict: vi.fn(),
      verifyPlanCoverageForSpecialty: vi.fn().mockResolvedValue(planCoverage),
      createAppointment: createRecord,
    } as unknown as CreateAppointmentRepository,
    createRecord,
  };
}

async function createSpecialty(repository: CreateAppointmentRepository) {
  return createAppointment({
    requestId: 'request-specialty',
    input: {
      professionalProfileId: null,
      specialty: 'Clinico Geral',
      date: futureDate(),
      time: '08:00',
      symptoms: '',
      priority: false,
      fundingSource: 'self_pay',
    },
    authenticatedUser: { authUserId: 'auth-patient', email: 'patient@example.invalid' },
    repository,
  });
}

function queueRepository(planCoverage: typeof coverage | null) {
  const createQueueEntry = vi.fn(async (params) => ({
    id: '80000000-0000-4000-8000-000000000001',
    patient_id: params.patientId,
    patient_name: params.patientName,
    patient_email: params.patientEmail,
    specialty: params.specialty,
    symptoms: params.symptoms,
    priority_level: params.priorityLevel,
    status: 'waiting',
    position: params.position,
    estimated_wait_time: params.estimatedWaitTime,
    assigned_professional_id: null,
    solicitacao_exame_id: null,
    service_code: params.pricing.serviceCode,
    price_source: params.pricing.priceSource,
    quoted_gross_price: params.pricing.grossPrice,
    quoted_platform_fee_percent: params.pricing.platformFeePercent,
    quoted_platform_fee_amount: params.pricing.platformFeeAmount,
    quoted_professional_net_amount: params.pricing.professionalNetAmount,
    pricing_rule_id: params.pricing.pricingRuleId,
    fee_rule_id: params.pricing.feeRuleId,
    payment_status: 'payment_pending',
    payment_required: !params.planCoverage,
    current_payment_charge_id: params.planCoverage ? null : 'charge-id',
    paid_at: null,
    funding_source: params.planCoverage ? 'plan' : 'self_pay',
    coverage_status: params.planCoverage ? 'plan_pending_use' : null,
    plan_credit_usage_id: params.planCoverage ? usageId : null,
    plan_subscription_order_id: params.planCoverage?.planSubscriptionOrderId || null,
    external_subscription_score_id: params.planCoverage?.externalSubscriptionScoreId || null,
    external_score_id: params.planCoverage?.externalScoreId || null,
    external_plan_id: params.planCoverage?.externalPlanId || null,
    external_specialization_id: params.planCoverage?.externalSpecializationId || null,
  }));

  return {
    repository: {
      findAppUserByAuthUserId: vi.fn().mockResolvedValue({
        id: patientId,
        authUserId: 'auth-patient',
        fullName: 'Patient Test',
        email: 'patient@example.invalid',
        role: 'patient',
        isActive: true,
      }),
      findActivePlantaoConsultaByPatientId: vi.fn().mockResolvedValue(null),
      findCurrentActiveQueueEntry: vi.fn().mockResolvedValue(null),
      findSolicitacaoPaymentSnapshot: vi.fn(),
      listOnDutyPublicProfiles: vi.fn().mockResolvedValue([{
        id: professionalId,
        specialty: 'Clinico Geral',
        status: 'approved',
        isOnDuty: true,
      }]),
      resolveServicePricing: vi.fn().mockResolvedValue({
        serviceCode: 'on_duty_clinico_geral',
        priceSource: 'platform_fixed',
        grossPrice: 100,
        platformFeePercent: 0.1,
        platformFeeAmount: 10,
        professionalNetAmount: 90,
        pricingRuleId: '60000000-0000-4000-8000-000000000001',
        feeRuleId: '70000000-0000-4000-8000-000000000001',
      }),
      resolvePlanCoverage: vi.fn().mockResolvedValue(planCoverage),
      countWaitingQueueBySpecialty: vi.fn().mockResolvedValue(0),
      createQueueEntry,
    } as unknown as JoinQueueRepository,
    createQueueEntry,
  };
}

async function createQueue(repository: JoinQueueRepository) {
  return joinQueue({
    requestId: 'request-queue',
    input: {
      specialty: 'Clinico Geral',
      symptoms: '',
      priorityLevel: 'normal',
      solicitacaoExameId: '',
    },
    authenticatedUser: { authUserId: 'auth-patient', email: 'patient@example.invalid' },
    repository,
  });
}

describe('plan flow integrity', () => {
  it('revalidates specialty coverage server-side even when the client requests self-pay', async () => {
    const { repository, createRecord } = appointmentRepository(coverage);
    const result = await createSpecialty(repository);

    expect(repository.verifyPlanCoverageForSpecialty).toHaveBeenCalledOnce();
    expect(createRecord).toHaveBeenCalledWith(expect.objectContaining({
      fundingSource: 'plan',
      planCoverage: coverage,
    }));
    expect(result.appointment.paymentRequired).toBe(false);
    expect(result.appointment.fundingSource).toBe('plan');
  });

  it('creates self-pay specialty flow only when server-side coverage is absent', async () => {
    const { repository, createRecord } = appointmentRepository(null);
    const result = await createSpecialty(repository);

    expect(createRecord).toHaveBeenCalledWith(expect.objectContaining({
      fundingSource: 'self_pay',
      planCoverage: null,
    }));
    expect(result.appointment.paymentRequired).toBe(true);
  });

  it('does not silently create a specialty appointment when plan validation fails', async () => {
    const { repository, createRecord } = appointmentRepository(null);
    vi.mocked(repository.verifyPlanCoverageForSpecialty).mockRejectedValueOnce(
      Object.assign(new Error('temporary'), { code: 'PLANS_SERVICE_TIMEOUT' }),
    );

    await expect(createSpecialty(repository)).rejects.toMatchObject({ code: 'PLANS_SERVICE_TIMEOUT' });
    expect(createRecord).not.toHaveBeenCalled();
  });

  it('creates a covered on-duty queue without a payment requirement', async () => {
    const { repository, createQueueEntry } = queueRepository(coverage);
    const result = await createQueue(repository);

    expect(repository.resolvePlanCoverage).toHaveBeenCalledOnce();
    expect(createQueueEntry).toHaveBeenCalledWith(expect.objectContaining({ planCoverage: coverage }));
    expect(result.queueEntry.paymentRequired).toBe(false);
    expect(result.queueEntry.fundingSource).toBe('plan');
  });

  it('creates a self-pay on-duty queue when no eligible credit exists', async () => {
    const { repository, createQueueEntry } = queueRepository(null);
    const result = await createQueue(repository);

    expect(createQueueEntry).toHaveBeenCalledWith(expect.objectContaining({ planCoverage: null }));
    expect(result.queueEntry.paymentRequired).toBe(true);
    expect(result.queueEntry.fundingSource).toBe('self_pay');
  });

  it('does not create or charge a queue when plan validation is temporarily unavailable', async () => {
    const { repository, createQueueEntry } = queueRepository(null);
    vi.mocked(repository.resolvePlanCoverage).mockRejectedValueOnce(
      Object.assign(new Error('temporary'), { code: 'PLANS_SERVICE_TIMEOUT' }),
    );

    await expect(createQueue(repository)).rejects.toMatchObject({ code: 'PLANS_SERVICE_TIMEOUT' });
    expect(createQueueEntry).not.toHaveBeenCalled();
  });

  it('confirms a queue credit before the plan-specific acceptance transaction', async () => {
    const confirmCredit = vi.fn().mockResolvedValue({ skipped: false, reason: 'used_now' });
    const acceptTransaction = vi.fn().mockResolvedValue({
      queue_id: '80000000-0000-4000-8000-000000000001',
      queue_status: 'assigned',
      queue_assigned_professional_id: professionalId,
      queue_patient_id: patientId,
      queue_patient_name: 'Patient Test',
      queue_specialty: 'Clinico Geral',
      queue_position: 1,
      queue_estimated_wait_time: 0,
      queue_solicitacao_exame_id: '',
      consulta_id: '90000000-0000-4000-8000-000000000001',
      consulta_status: 'aguardando',
      consulta_tipo: 'plantao',
      consulta_datetime: '2026-07-12T12:00:00Z',
      consulta_professional_id: professionalId,
      consulta_professional_user_id: 'professional-user',
      consulta_professional_name: 'Professional Test',
    });
    const repository = {
      findAppUserByAuthUserId: vi.fn().mockResolvedValue({
        id: 'professional-user',
        authUserId: 'auth-professional',
        fullName: 'Professional Test',
        role: 'professional',
        isActive: true,
      }),
      findProfessionalDutyContextByUserId: vi.fn().mockResolvedValue({
        appUserId: 'professional-user',
        profileId: professionalId,
        fullName: 'Professional Test',
        specialty: 'Clinico Geral',
        isOnDuty: true,
        publicStatus: 'approved',
        source: 'professional_profiles',
      }),
      findPlanQueueAcceptanceContext: vi.fn().mockResolvedValue({
        queue: {
          id: '80000000-0000-4000-8000-000000000001',
          specialty: 'Clinico Geral',
          status: 'waiting',
          fundingSource: 'plan',
          coverageStatus: 'plan_pending_use',
          paymentRequired: false,
          planCreditUsageId: usageId,
        },
        usage: {
          id: usageId,
          status: 'pending_use',
          externalSubscriptionScoreId: '156',
        },
      }),
      confirmPlanCreditBeforeAcceptance: confirmCredit,
      acceptQueueEntry: acceptTransaction,
    } as unknown as AcceptQueueEntryRepository;

    await acceptQueueEntry({
      requestId: 'request-accept-queue',
      queueId: '80000000-0000-4000-8000-000000000001',
      authenticatedUser: { authUserId: 'auth-professional', email: null },
      repository,
    });

    expect(confirmCredit).toHaveBeenCalledOnce();
    expect(acceptTransaction).toHaveBeenCalledWith(expect.objectContaining({ planFunded: true }));
    expect(confirmCredit.mock.invocationCallOrder[0]).toBeLessThan(acceptTransaction.mock.invocationCallOrder[0]);
  });

  it('keeps profile standard and priority appointments strictly self-pay', () => {
    const profilePage = readFileSync('src/pages/AgendamentoPerfil.jsx', 'utf8');
    const service = readFileSync('supabase/functions/create-appointment/service.ts', 'utf8');

    expect(profilePage).not.toContain('checkPlanCoverage');
    expect(profilePage).not.toContain('subscription-score');
    expect(profilePage).toContain("priority: data.appointment_type === 'priority'");
    expect(service).toContain('PLAN_FUNDING_NOT_ALLOWED_FOR_PROFILE');
    expect(service).toContain('PROFILE_STANDARD_SERVICE_CODE');
    expect(service).toContain('PROFILE_PRIORITY_SERVICE_CODE');
  });

  it('enforces one usage per owner, one owner per external score, and no plan charge', () => {
    const migration = readFileSync(
      'supabase/migrations/20260712190000_harden_plan_coverage_credit_integrity.sql',
      'utf8',
    );
    const paymentCreator = readFileSync(
      'supabase/functions/_shared/payments/create-payment-charge.ts',
      'utf8',
    );
    const ensurePayment = readFileSync('supabase/functions/ensure-payment-charge/index.ts', 'utf8');

    expect(migration).toContain('idx_plan_credit_usages_active_owner_unique');
    expect(migration).toContain('idx_plan_credit_usages_open_external_score_unique');
    expect(migration).toContain('enforce_payment_charge_plan_exclusivity');
    expect(migration).toContain('create_plan_funded_appointment');
    expect(migration).toContain('create_plan_funded_queue');
    expect(paymentCreator).toContain('PAYMENT_NOT_REQUIRED_FOR_COVERED_OWNER');
    expect(ensurePayment).toContain('PAYMENT_NOT_REQUIRED_FOR_COVERED_OWNER');
  });
});
