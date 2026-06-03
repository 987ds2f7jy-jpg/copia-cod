import { describe, expect, it } from 'vitest';
import {
  getAppointmentExpirationCutoff,
  isSpecialtyAppointmentRequestExpired,
  resolveAppointmentScheduledComparable,
} from '../../supabase/functions/_shared/appointments/expiration';

describe('specialty appointment expiration rule', () => {
  const now = new Date('2026-06-02T15:00:00Z');

  it('expires requested specialty appointments after the 10 minute tolerance', () => {
    expect(isSpecialtyAppointmentRequestExpired({
      status: 'SOLICITADO',
      appointmentType: 'ESPECIALIDADE',
      scheduledDatetime: '2026-06-02T11:49:59',
    }, now)).toBe(true);
  });

  it('keeps future specialty appointment requests acceptable', () => {
    expect(isSpecialtyAppointmentRequestExpired({
      status: 'SOLICITADO',
      appointmentType: 'ESPECIALIDADE',
      scheduledDatetime: '2026-06-02T12:05:00',
    }, now)).toBe(false);
  });

  it('does not expire non-specialty appointment types in this phase', () => {
    expect(isSpecialtyAppointmentRequestExpired({
      status: 'SOLICITADO',
      appointmentType: 'priority',
      scheduledDatetime: '2026-06-02T11:00:00',
    }, now)).toBe(false);
  });

  it('uses date and time fallback when scheduled_datetime is absent', () => {
    expect(resolveAppointmentScheduledComparable({
      date: '2026-06-02',
      time: '12:20',
    })).toBe('2026-06-02T12:20:00');
  });

  it('formats the cutoff in the application appointment timezone', () => {
    expect(getAppointmentExpirationCutoff(now)).toBe('2026-06-02T11:50:00');
  });
});
