import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import ResumeConsultationCard from '@/components/teleconsulta/ResumeConsultationCard';
import { getConsultationEntryState } from '@/hooks/useConsultationEntryState';

const now = Date.parse('2030-01-15T10:00:00.000Z');

function activeConsultation(overrides: Record<string, unknown> = {}) {
  const consultation = {
    id: 'consulta-1',
    status: 'aguardando',
    consultationType: 'padrao',
    datetime: '2030-01-15T10:10:00.000Z',
    ...(overrides.consultation as Record<string, unknown> || {}),
  };
  const scheduledAt = String(consultation.datetime || '');
  const scheduledTimestamp = Date.parse(scheduledAt);
  const deadlineAt = Number.isFinite(scheduledTimestamp)
    ? new Date(scheduledTimestamp + 30 * 60 * 1000).toISOString()
    : null;

  return {
    hasActiveConsultation: true,
    participantRole: 'professional',
    resumeUrl: '/consulta/consulta-1',
    consultation,
    entryEligibility: {
      state: 'within_start_window',
      scheduledAt,
      deadlineAt,
      serverNow: new Date(now).toISOString(),
      canStart: true,
      effectivelyExpired: false,
    },
    ...overrides,
  };
}

describe('consultation entry state', () => {
  it('hides an accepted, unstarted scheduled consultation more than five minutes away', () => {
    expect(getConsultationEntryState(activeConsultation(), now)).toMatchObject({ kind: 'hidden' });
  });

  it('shows a countdown during the final five minutes without enabling entry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    render(
      <ResumeConsultationCard
        activeConsultation={activeConsultation({
          consultation: {
            id: 'consulta-1',
            status: 'aguardando',
            consultationType: 'padrao',
            datetime: '2030-01-15T10:04:59.000Z',
          },
        })}
        onResume={vi.fn()}
      />,
    );

    expect(screen.getByText('Sua consulta começa em 04:59')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar consulta' })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(299_000);
    });

    expect(screen.getByText('Sua consulta pode começar agora')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar consulta' })).toBeEnabled();
    vi.useRealTimers();
  });

  it('switches to the role-specific action at the scheduled start without invoking it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const onResume = vi.fn();
    const active = activeConsultation({
      participantRole: 'patient',
      consultation: {
        id: 'consulta-1',
        status: 'aguardando',
        consultationType: 'padrao',
        datetime: '2030-01-15T10:00:00.000Z',
      },
    });

    expect(getConsultationEntryState(active, now)).toMatchObject({ kind: 'ready' });
    render(<ResumeConsultationCard activeConsultation={active} onResume={onResume} />);

    expect(screen.getByRole('button', { name: 'Entrar na consulta' })).toBeEnabled();
    expect(onResume).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('hides a scheduled consultation after the server-provided deadline', () => {
    const active = activeConsultation({
      entryEligibility: {
        state: 'deadline_elapsed',
        scheduledAt: '2030-01-15T09:00:00.000Z',
        deadlineAt: '2030-01-15T09:30:00.000Z',
        serverNow: new Date(now).toISOString(),
        canStart: false,
        effectivelyExpired: true,
      },
    });

    expect(getConsultationEntryState(active, now)).toMatchObject({ kind: 'hidden' });
  });

  it('prioritizes an ongoing consultation and allows backend-authorized recovery without storage', () => {
    const active = activeConsultation({
      consultation: {
        id: 'consulta-em-andamento',
        status: 'em_atendimento',
        consultationType: 'padrao',
        datetime: '2030-01-15T11:00:00.000Z',
      },
    });

    expect(getConsultationEntryState(active, now)).toMatchObject({ kind: 'resume' });
  });

  it.each(['finalizada', 'cancelada', 'SOLICITADO', 'accepted'])('hides non-active %s consultations', (status) => {
    expect(getConsultationEntryState(activeConsultation({
      consultation: {
        id: 'consulta-1',
        status,
        consultationType: 'padrao',
        datetime: '2030-01-15T10:00:00.000Z',
      },
    }), now)).toMatchObject({ kind: 'hidden' });
  });

  it('preserves immediate-duty recovery without applying a scheduled countdown', () => {
    expect(getConsultationEntryState(activeConsultation({
      consultation: {
        id: 'plantao-1',
        status: 'aguardando',
        consultationType: 'plantao',
        datetime: '2030-01-15T15:00:00.000Z',
      },
    }), now)).toMatchObject({ kind: 'resume' });
  });

  it('hides scheduled consultations with an invalid timestamp safely', () => {
    expect(getConsultationEntryState(activeConsultation({
      consultation: {
        id: 'consulta-invalida',
        status: 'aguardando',
        consultationType: 'padrao',
        datetime: 'invalid-date',
      },
    }), now)).toMatchObject({ kind: 'hidden' });
  });
});
