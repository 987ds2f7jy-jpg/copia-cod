import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  dispatchDailyAppointmentReminders,
  getSaoPauloDate,
  resolveAppointmentLocalTime,
} from '../../supabase/functions/notifications-dispatch-scheduled/service.ts';
import type {
  AppointmentReminderRecord,
  AppointmentReminderRepository,
} from '../../supabase/functions/notifications-dispatch-scheduled/types.ts';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function appointment(
  overrides: Partial<AppointmentReminderRecord> = {},
): AppointmentReminderRecord {
  return {
    id: 'appointment-1',
    patient_id: 'patient-1',
    professional_id: null,
    appointment_type: 'scheduled',
    scheduled_datetime: '2026-09-23T14:30:00',
    date: '2026-09-23',
    time: '14:30:00',
    status: 'confirmed',
    ...overrides,
  };
}

function repository(
  appointments: AppointmentReminderRecord[],
  professionalUserId = 'professional-user-1',
): AppointmentReminderRepository {
  return {
    listAppointmentsForDate: vi.fn().mockResolvedValue(appointments),
    findProfessionalAppUserId: vi.fn().mockResolvedValue(professionalUserId),
  };
}

describe('internal notifications Phase 3B', () => {
  it('emits registration submitted only after both profile writes', () => {
    const service = read('supabase/functions/register-professional/service.ts');
    const notification = service.slice(
      service.indexOf("typeKey: 'professional.registration_submitted'"),
    );

    expect(service.indexOf("typeKey: 'professional.registration_submitted'")).toBeGreaterThan(
      service.indexOf('await repository.createPublicProfile'),
    );
    expect(notification).toContain('recipientUserId: appUser.id');
    expect(notification).toContain(
      'professional_profile:${privateProfile.id}:submitted:${appUser.id}',
    );
    expect(notification).not.toMatch(/data:\s*\{/);
    expect(notification).not.toMatch(/cpf|email|telefone|registro/i);
  });

  it('catalogs activation failure and updates the reminder template idempotently', () => {
    const migration = read(
      'supabase/migrations/20260923090000_add_phase3b_notification_types.sql',
    );

    expect(migration).toContain("'plan.activation_failed'");
    expect(migration).toContain('ON CONFLICT (key) DO NOTHING');
    expect(migration).toContain("WHERE key = 'appointment.reminder_day'");
    expect(migration).toContain(
      'Você tem uma consulta hoje às {{appointment_time}}.',
    );
  });

  it('emits plan activation failure only after the failure state is persisted', () => {
    const helper = read('supabase/functions/_shared/plans/activate-plan-subscription.ts');
    const notificationStart = helper.indexOf("typeKey: 'plan.activation_failed'");
    const notification = helper.slice(
      notificationStart,
      helper.indexOf('      });', notificationStart) + '      });'.length,
    );

    expect(helper.indexOf("typeKey: 'plan.activation_failed'")).toBeGreaterThan(
      helper.indexOf('await markOrderActivationFailed'),
    );
    expect(helper.indexOf("reason: 'already_active'")).toBeLessThan(
      helper.indexOf("typeKey: 'plan.activation_failed'"),
    );
    expect(notification).toContain(
      'plan_order:${order.id}:activation_failed:${recipientUserId}',
    );
    expect(notification).not.toMatch(/data:\s*\{/);
    expect(notification).not.toMatch(/provider|requestSnapshot|stack/i);
  });

  it('notifies the patient and only the assigned professional with stable keys', async () => {
    const notify = vi.fn().mockResolvedValue({ skipped: false, deduplicated: false });
    const repo = repository([
      appointment({ professional_id: 'professional-profile-1' }),
      appointment({ id: 'appointment-2', patient_id: 'patient-2' }),
    ]);

    const summary = await dispatchDailyAppointmentReminders({
      date: '2026-09-23',
      executionId: 'execution-1',
      repository: repo,
      notificationService: { notify } as never,
    });

    expect(notify).toHaveBeenCalledTimes(3);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: 'patient-1',
      data: { appointment_time: '14:30' },
      deduplicationKey: 'appointment:appointment-1:reminder_day:patient:patient-1',
    }));
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: 'professional-user-1',
      deduplicationKey:
        'appointment:appointment-1:reminder_day:professional:professional-user-1',
    }));
    expect(repo.findProfessionalAppUserId).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({ recipientsProcessed: 3, created: 3, failed: 0 });
  });

  it('skips appointments from another day and incompatible statuses', async () => {
    const notify = vi.fn();
    const repo = repository([
      appointment({ id: 'other-day', date: '2026-09-24' }),
      appointment({ id: 'cancelled', status: 'cancelled' }),
      appointment({ id: 'finished', status: 'completed' }),
    ]);

    const summary = await dispatchDailyAppointmentReminders({
      date: '2026-09-23',
      executionId: 'execution-2',
      repository: repo,
      notificationService: { notify } as never,
    });

    expect(notify).not.toHaveBeenCalled();
    expect(summary.appointmentsEligible).toBe(0);
  });

  it('reuses the same keys so a repeated run is deduplicated by the service', async () => {
    const seen = new Set<string>();
    const notify = vi.fn(async ({ deduplicationKey }: { deduplicationKey: string }) => {
      const deduplicated = seen.has(deduplicationKey);
      seen.add(deduplicationKey);
      return { skipped: false, deduplicated };
    });
    const repo = repository([appointment()]);

    const first = await dispatchDailyAppointmentReminders({
      date: '2026-09-23',
      executionId: 'execution-3',
      repository: repo,
      notificationService: { notify } as never,
    });
    const second = await dispatchDailyAppointmentReminders({
      date: '2026-09-23',
      executionId: 'execution-4',
      repository: repo,
      notificationService: { notify } as never,
    });

    expect(first.created).toBe(1);
    expect(second.deduplicated).toBe(1);
    expect(seen.size).toBe(1);
  });

  it('formats appointment time as HH:mm in America/Sao_Paulo', () => {
    expect(getSaoPauloDate(new Date('2026-09-23T03:15:00Z'))).toBe('2026-09-23');
    expect(resolveAppointmentLocalTime(appointment({
      time: null,
      scheduled_datetime: '2026-09-23T17:30:00Z',
    }))).toBe('14:30');
  });

  it('continues the batch when one recipient notification fails', async () => {
    const notify = vi.fn()
      .mockRejectedValueOnce(new Error('temporary notification failure'))
      .mockResolvedValue({ skipped: false, deduplicated: false });

    const summary = await dispatchDailyAppointmentReminders({
      date: '2026-09-23',
      executionId: 'execution-5',
      repository: repository([
        appointment(),
        appointment({ id: 'appointment-2', patient_id: 'patient-2' }),
      ]),
      notificationService: { notify } as never,
    });

    expect(notify).toHaveBeenCalledTimes(2);
    expect(summary).toMatchObject({ failed: 1, created: 1, recipientsProcessed: 2 });
  });
});
