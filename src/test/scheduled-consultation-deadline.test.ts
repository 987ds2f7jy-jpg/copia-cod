import { describe, expect, it } from 'vitest';
import {
  getScheduledConsultationDeadline,
  parseScheduledConsultationTimestamp,
} from '../../supabase/functions/_shared/scheduled-consultation-deadline';

describe('scheduled consultation deadline', () => {
  const base = {
    tipo_consulta: 'padrao',
    status: 'aguardando',
    inicio_at: '',
  };

  it('interprets legacy offset-free schedules in America/Sao_Paulo', () => {
    expect(parseScheduledConsultationTimestamp('2030-01-15T10:00:00')?.toISOString())
      .toBe('2030-01-15T13:00:00.000Z');
  });

  it('preserves the actual instant for offset-bearing schedules', () => {
    expect(parseScheduledConsultationTimestamp('2030-01-15T10:00:00+02:00')?.toISOString())
      .toBe('2030-01-15T08:00:00.000Z');
  });

  it('allows the scheduled start through the deadline inclusively', () => {
    const consultation = { ...base, datetime: '2030-01-15T10:00:00.000Z' };
    expect(getScheduledConsultationDeadline(consultation, new Date('2030-01-15T10:00:00.000Z')).state)
      .toBe('within_start_window');
    expect(getScheduledConsultationDeadline(consultation, new Date('2030-01-15T10:30:00.000Z')).state)
      .toBe('within_start_window');
    expect(getScheduledConsultationDeadline(consultation, new Date('2030-01-15T10:30:00.001Z')).state)
      .toBe('deadline_elapsed');
  });

  it('never treats start evidence or duty care as not performed', () => {
    expect(getScheduledConsultationDeadline({ ...base, datetime: '2030-01-01T00:00:00Z', inicio_at: '2030-01-01T00:01:00Z' }).state)
      .toBe('started');
    expect(getScheduledConsultationDeadline({ ...base, tipo_consulta: 'plantao', datetime: '2030-01-01T00:00:00Z' }).state)
      .toBe('not_scheduled');
  });
});
