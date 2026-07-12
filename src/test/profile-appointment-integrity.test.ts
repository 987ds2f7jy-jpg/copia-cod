import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createAppointment } from '../../supabase/functions/create-appointment/service';
import { acceptAppointment } from '../../supabase/functions/accept-appointment/service';
import type { CreateAppointmentRepository } from '../../supabase/functions/create-appointment/types';
import type {
  AcceptAppointmentRepository,
  AppointmentAcceptanceWindowRecord,
} from '../../supabase/functions/accept-appointment/types';

const professionalProfileId = '20000000-0000-4000-8000-000000000001';

function futureDate(days = 4) {
  const value = new Date();
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() + days);
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

function appointmentWindow(overrides: Partial<AppointmentAcceptanceWindowRecord> = {}): AppointmentAcceptanceWindowRecord {
  return {
    id: '30000000-0000-4000-8000-000000000001',
    status: 'SOLICITADO',
    appointmentType: 'PERFIL',
    scheduledDatetime: `${futureDate()}T08:00:00`,
    date: futureDate(),
    time: '08:00',
    paymentRequired: true,
    paymentStatus: 'paid',
    currentPaymentChargeId: '40000000-0000-4000-8000-000000000001',
    professionalId: professionalProfileId,
    consultaId: null,
    ...overrides,
  };
}

const transactionResult = {
  appointment_id: '30000000-0000-4000-8000-000000000001',
  appointment_status: 'accepted',
  appointment_accepted_at: '2026-07-12T12:00:00.000Z',
  appointment_scheduled_datetime: '2026-07-16T08:00:00',
  appointment_professional_id: professionalProfileId,
  appointment_professional_name: 'Profissional Teste',
  consulta_id: '50000000-0000-4000-8000-000000000001',
  consulta_status: 'aguardando',
  consulta_tipo: 'padrao',
  consulta_datetime: '2026-07-16T08:00:00',
};

describe('profile appointment integrity', () => {
  it('creates a standard profile appointment requested, assigned and without an early consultation', async () => {
    const date = futureDate();
    const weekday = new Date(`${date}T12:00:00`).getDay();
    const createRecord = vi.fn(async (params) => ({
      id: '30000000-0000-4000-8000-000000000001',
      patient_id: params.patientId,
      patient_name: params.patientName,
      patient_email: params.patientEmail,
      professional_id: params.professionalId,
      professional_name: params.professionalName,
      specialty: params.specialty,
      appointment_type: params.appointmentType,
      scheduled_datetime: params.scheduledDatetime,
      date: params.date,
      time: params.time,
      status: params.status,
      price: params.price,
      payment_status: 'payment_pending',
      payment_required: true,
      current_payment_charge_id: '40000000-0000-4000-8000-000000000001',
      funding_source: 'self_pay',
      coverage_status: null,
      plan_credit_usage_id: null,
      plan_subscription_order_id: null,
      external_subscription_score_id: null,
      external_score_id: null,
      external_plan_id: null,
      external_specialization_id: null,
      symptoms: params.symptoms,
      accepted_at: null,
      consulta_id: null,
      service_code: 'profile_standard',
      price_source: 'professional_profile',
      gross_price: 120,
      platform_fee_percent: 0.1,
      platform_fee_amount: 12,
      professional_net_amount: 108,
      pricing_rule_id: null,
      fee_rule_id: null,
      coverage_snapshot: {},
    }));
    const repository = {
      findAppUserByAuthUserId: vi.fn().mockResolvedValue({
        id: '10000000-0000-4000-8000-000000000001',
        authUserId: 'auth-patient',
        fullName: 'Paciente Teste',
        email: 'patient@example.invalid',
        role: 'patient',
        isActive: true,
      }),
      findProfessionalTargetById: vi.fn().mockResolvedValue({
        profileId: professionalProfileId,
        appUserId: '10000000-0000-4000-8000-000000000002',
        fullName: 'Profissional Teste',
        specialty: 'Clinico Geral',
        status: 'approved',
        priceStandard: 120,
        pricePriority: 180,
        availableHours: [],
        source: 'professional_profiles',
      }),
      resolveServicePricing: vi.fn().mockResolvedValue({
        serviceCode: 'profile_standard',
        priceSource: 'professional_profile',
        grossPrice: 120,
        platformFeePercent: 0.1,
        platformFeeAmount: 12,
        professionalNetAmount: 108,
        pricingRuleId: null,
        feeRuleId: null,
      }),
      listAvailabilitySlots: vi.fn().mockResolvedValue([{ weekday, timeSlot: '08:00' }]),
      hasActiveAppointmentConflict: vi.fn().mockResolvedValue(false),
      verifyPlanCoverageForSpecialty: vi.fn(),
      createAppointment: createRecord,
    } as unknown as CreateAppointmentRepository;

    const result = await createAppointment({
      requestId: 'request-create',
      input: {
        professionalProfileId,
        specialty: '',
        date,
        time: '08:00',
        symptoms: '',
        priority: false,
        fundingSource: 'self_pay',
      },
      authenticatedUser: { authUserId: 'auth-patient', email: 'patient@example.invalid' },
      repository,
    });

    expect(createRecord).toHaveBeenCalledWith(expect.objectContaining({
      status: 'SOLICITADO',
      appointmentType: 'PERFIL',
      professionalId: professionalProfileId,
      fundingSource: 'self_pay',
    }));
    expect(result.appointment.status).toBe('SOLICITADO');
    expect(result.appointment.professionalId).toBe(professionalProfileId);
    expect((result.appointment as Record<string, unknown>).consultaId).toBeUndefined();
  });

  it('blocks acceptance before payment confirmation', async () => {
    const acceptTransaction = vi.fn();
    const repository = makeAcceptRepository({
      window: appointmentWindow({ paymentStatus: 'payment_pending' }),
      acceptTransaction,
    });

    await expect(runAccept(repository)).rejects.toMatchObject({
      status: 402,
      code: 'APPOINTMENT_PAYMENT_REQUIRED',
    });
    expect(acceptTransaction).not.toHaveBeenCalled();
  });

  it('rejects a different professional and returns the same consultation on a repeated acceptance', async () => {
    const wrongProfessionalRepository = makeAcceptRepository({
      window: appointmentWindow({
        status: 'accepted',
        consultaId: transactionResult.consulta_id,
        professionalId: '20000000-0000-4000-8000-000000000099',
      }),
    });

    await expect(runAccept(wrongProfessionalRepository)).rejects.toMatchObject({
      status: 403,
      code: 'PROFESSIONAL_PROFILE_MISMATCH',
    });

    const acceptTransaction = vi.fn().mockResolvedValue(transactionResult);
    const findWindow = vi.fn()
      .mockResolvedValueOnce(appointmentWindow())
      .mockResolvedValueOnce(appointmentWindow({
        status: 'accepted',
        consultaId: transactionResult.consulta_id,
      }));
    const repository = makeAcceptRepository({
      window: appointmentWindow(),
      acceptTransaction,
      findWindow,
      acceptedResult: transactionResult,
    });

    const first = await runAccept(repository);
    const repeated = await runAccept(repository);

    expect(acceptTransaction).toHaveBeenCalledTimes(1);
    expect(first.consulta.id).toBe(transactionResult.consulta_id);
    expect(repeated.consulta.id).toBe(transactionResult.consulta_id);
    expect(first.appointment.professionalId).toBe(repeated.appointment.professionalId);
  });

  it('enforces paid ownership and one active request per professional slot in the database', () => {
    const migration = readFileSync('supabase/migrations/20260712090000_harden_profile_appointment_acceptance.sql', 'utf8');
    const transaction = readFileSync('supabase/migrations/20260602120000_block_expired_specialty_appointment_acceptance.sql', 'utf8');

    expect(migration).toContain('appointments_active_professional_schedule_unique');
    expect(migration).toContain("pc.owner_type = 'appointment'");
    expect(migration).toContain("pc.status = 'paid'");
    expect(transaction).toContain('FOR UPDATE');
    expect(transaction).toContain('pg_advisory_xact_lock');
    expect(transaction.match(/INSERT INTO public\.consultas/g)).toHaveLength(1);
  });

  it('shows paid standard requests only to the selected professional as awaiting acceptance', () => {
    const dashboard = readFileSync('src/components/dashboard/SolicitacoesAgendamento.jsx', 'utf8');
    const schedulingPage = readFileSync('src/pages/AgendamentoPerfil.jsx', 'utf8');
    const readModels = readFileSync('supabase/functions/read-models/index.ts', 'utf8');

    expect(dashboard).toContain("appointment_type: 'PERFIL'");
    expect(dashboard).toContain('professional_id: professional.id');
    expect(readModels).toContain("'payment_status.eq.paid'");
    expect(schedulingPage).toContain('Aguardando aceite');
    expect(schedulingPage).not.toContain('Agendamento Confirmado!');
  });
});

function makeAcceptRepository({
  window,
  acceptTransaction = vi.fn().mockResolvedValue(transactionResult),
  findWindow = vi.fn().mockResolvedValue(window),
  acceptedResult = null,
}: {
  window: AppointmentAcceptanceWindowRecord;
  acceptTransaction?: ReturnType<typeof vi.fn>;
  findWindow?: ReturnType<typeof vi.fn>;
  acceptedResult?: typeof transactionResult | null;
}) {
  return {
    findAppUserByAuthUserId: vi.fn().mockResolvedValue({
      id: '10000000-0000-4000-8000-000000000002',
      authUserId: 'auth-professional',
      fullName: 'Profissional Teste',
      role: 'professional',
      isActive: true,
    }),
    findActiveProfessionalProfileByUserId: vi.fn().mockResolvedValue({
      appUserId: '10000000-0000-4000-8000-000000000002',
      profileId: professionalProfileId,
      fullName: 'Profissional Teste',
      specialty: 'Clinico Geral',
      source: 'professional_profiles',
    }),
    findAppointmentAcceptanceWindow: findWindow,
    findPlanAppointmentAcceptanceContext: vi.fn().mockResolvedValue(null),
    findAcceptedAppointmentResult: vi.fn().mockResolvedValue(acceptedResult),
    confirmPlanCreditBeforeAcceptance: vi.fn(),
    acceptAppointment: acceptTransaction,
  } as unknown as AcceptAppointmentRepository;
}

function runAccept(repository: AcceptAppointmentRepository) {
  return acceptAppointment({
    requestId: 'request-accept',
    appointmentId: '30000000-0000-4000-8000-000000000001',
    authenticatedUser: { authUserId: 'auth-professional', email: null },
    repository,
  });
}
