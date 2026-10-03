import { describe, expect, it, vi } from 'vitest';
import { acceptAppointment } from '../../supabase/functions/accept-appointment/service';
import { acceptQueueEntry } from '../../supabase/functions/accept-queue-entry/service';

const patient = '10000000-0000-4000-8000-000000000001';
const professional = '20000000-0000-4000-8000-000000000001';
const usage = '30000000-0000-4000-8000-000000000001';
const appointment = '40000000-0000-4000-8000-000000000001';
const queue = '50000000-0000-4000-8000-000000000001';

const appointmentRow = {
  appointment_id: appointment, appointment_status: 'accepted', appointment_accepted_at: '2026-10-03T12:00:00Z',
  appointment_scheduled_datetime: '2026-10-04T12:00:00Z', appointment_professional_id: professional,
  appointment_professional_name: 'Professional', consulta_id: '60000000-0000-4000-8000-000000000001',
  consulta_status: 'aguardando', consulta_tipo: 'especialidade', consulta_datetime: '2026-10-04T12:00:00Z',
};
const queueRow = {
  queue_id: queue, queue_status: 'assigned', queue_assigned_professional_id: professional,
  queue_patient_id: patient, queue_patient_name: 'Patient', queue_specialty: 'clinico_geral',
  queue_position: 1, queue_estimated_wait_time: 0, queue_solicitacao_exame_id: '',
  consulta_id: '70000000-0000-4000-8000-000000000001', consulta_status: 'aguardando',
  consulta_tipo: 'plantao', consulta_datetime: '2026-10-03T12:00:00Z',
  consulta_professional_id: professional, consulta_professional_user_id: 'pro-user',
  consulta_professional_name: 'Professional',
};

function baseUser() {
  return { id: 'pro-user', authUserId: 'auth-user', fullName: 'Professional', role: 'professional', isActive: true };
}

function appointmentRepository(plan = true) {
  return {
    findAppUserByAuthUserId: vi.fn().mockResolvedValue(baseUser()),
    findActiveProfessionalProfileByUserId: vi.fn().mockResolvedValue({
      appUserId: 'pro-user', profileId: professional, fullName: 'Professional', specialty: 'clinico_geral', source: 'professional_profiles',
    }),
    findAppointmentAcceptanceWindow: vi.fn().mockResolvedValue({
      id: appointment, patientUserId: patient, status: 'requested', appointmentType: 'especialidade',
      scheduledDatetime: '2026-10-04T12:00:00Z', date: null, time: null, paymentRequired: !plan,
      paymentStatus: plan ? 'payment_pending' : 'paid', currentPaymentChargeId: plan ? null : 'charge',
      professionalId: null, consultaId: null,
    }),
    findPlanAppointmentAcceptanceContext: vi.fn().mockResolvedValue(plan ? {
      appointment: { id: appointment, status: 'requested', fundingSource: 'plan', coverageStatus: 'plan_pending_use',
        paymentRequired: false, planCreditUsageId: usage, professionalId: null, professionalName: '',
        specialty: 'clinico_geral', scheduledDatetime: '2026-10-04T12:00:00Z', acceptedAt: null, consultaId: null },
      usage: { id: usage, status: 'pending_use', internalSubscriptionScoreId: 'score', requestSnapshot: {}, responseSnapshot: {} },
    } : null),
    findAcceptedAppointmentResult: vi.fn(),
    acceptPlanAppointment: vi.fn().mockResolvedValue({ row: appointmentRow, acceptedNow: true }),
    acceptAppointment: vi.fn().mockResolvedValue(appointmentRow),
  };
}

function queueRepository(plan = true) {
  return {
    findAppUserByAuthUserId: vi.fn().mockResolvedValue(baseUser()),
    findProfessionalDutyContextByUserId: vi.fn().mockResolvedValue({
      appUserId: 'pro-user', profileId: professional, fullName: 'Professional', specialty: 'clinico_geral',
      isOnDuty: true, publicStatus: 'approved', source: 'professional_profiles',
    }),
    findPlanQueueAcceptanceContext: vi.fn().mockResolvedValue(plan ? {
      queue: { id: queue, patientId: patient, specialty: 'clinico_geral', status: 'waiting',
        fundingSource: 'plan', coverageStatus: 'plan_pending_use', paymentRequired: false, planCreditUsageId: usage },
      usage: { id: usage, status: 'pending_use', internalSubscriptionScoreId: 'score' },
    } : null),
    acceptPlanQueueEntry: vi.fn().mockResolvedValue({ row: queueRow, acceptedNow: true }),
    acceptQueueEntry: vi.fn().mockResolvedValue(queueRow),
  };
}

const actor = { authUserId: 'auth-user', email: null };

describe('post-commit acceptance notifications', () => {
  it.each(['appointment', 'queue'] as const)('%s emits only after a successful new plan transaction', async (kind) => {
    const repository = (kind === 'appointment' ? appointmentRepository() : queueRepository()) as
      ReturnType<typeof appointmentRepository> & ReturnType<typeof queueRepository>;
    const transaction = kind === 'appointment' ? repository.acceptPlanAppointment : repository.acceptPlanQueueEntry;
    const notify = vi.fn().mockResolvedValue({ skipped: false });
    const run = () => kind === 'appointment'
      ? acceptAppointment({ requestId: 'test', appointmentId: appointment, authenticatedUser: actor, repository: repository as never, notificationService: { notify } })
      : acceptQueueEntry({ requestId: 'test', queueId: queue, authenticatedUser: actor, repository: repository as never, notificationService: { notify } });

    await run();
    expect(notify.mock.calls.map(([input]) => input.typeKey)).toEqual([
      'plan.credit_consumed', kind === 'appointment' ? 'appointment.accepted' : 'queue.accepted',
    ]);
    expect(transaction.mock.invocationCallOrder[0]).toBeLessThan(notify.mock.invocationCallOrder[0]);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      deduplicationKey: `plan_credit:${usage}:consumed:patient:${patient}`,
    }));

    notify.mockClear();
    transaction.mockRejectedValueOnce(new Error('transaction rolled back'));
    await expect(run()).rejects.toThrow('transaction rolled back');
    expect(notify).not.toHaveBeenCalled();

    transaction.mockResolvedValueOnce({ row: kind === 'appointment' ? appointmentRow : queueRow, acceptedNow: false });
    await run();
    expect(notify).not.toHaveBeenCalled();
  });

  it.each(['appointment', 'queue'] as const)('%s retains the self-pay RPC and acceptance notification', async (kind) => {
    const repository = (kind === 'appointment' ? appointmentRepository(false) : queueRepository(false)) as
      ReturnType<typeof appointmentRepository> & ReturnType<typeof queueRepository>;
    const notify = vi.fn().mockResolvedValue({ skipped: false });
    if (kind === 'appointment') {
      await acceptAppointment({ requestId: 'test', appointmentId: appointment, authenticatedUser: actor, repository: repository as never, notificationService: { notify } });
      expect(repository.acceptAppointment).toHaveBeenCalledOnce();
      expect(repository.acceptPlanAppointment).not.toHaveBeenCalled();
    } else {
      await acceptQueueEntry({ requestId: 'test', queueId: queue, authenticatedUser: actor, repository: repository as never, notificationService: { notify } });
      expect(repository.acceptQueueEntry).toHaveBeenCalledOnce();
      expect(repository.acceptPlanQueueEntry).not.toHaveBeenCalled();
    }
    expect(notify.mock.calls.map(([input]) => input.typeKey)).toEqual([
      kind === 'appointment' ? 'appointment.accepted' : 'queue.accepted',
    ]);
  });

  it('keeps committed plan acceptance successful when notification persistence fails', async () => {
    const repository = appointmentRepository();
    const notify = vi.fn().mockRejectedValue(new Error('notification unavailable'));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await expect(acceptAppointment({
        requestId: 'test', appointmentId: appointment, authenticatedUser: actor,
        repository: repository as never, notificationService: { notify },
      })).resolves.toMatchObject({ appointment: { id: appointment } });
      expect(repository.acceptPlanAppointment).toHaveBeenCalledOnce();
      expect(notify).toHaveBeenCalledTimes(2);
    } finally {
      logged.mockRestore();
    }
  });
});
