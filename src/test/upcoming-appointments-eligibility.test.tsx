import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UpcomingAppointments from '@/components/dashboard/UpcomingAppointments';

const scheduledAt = (offset: number) => `2030-01-${String(offset).padStart(2, '0')}T10:00:00.000Z`;

function appointment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'appointment-1',
    appointment_type: 'PERFIL',
    status: 'SOLICITADO',
    scheduled_datetime: scheduledAt(10),
    patient_name: 'Paciente de teste',
    ...overrides,
  };
}

function renderUpcoming(appointments: Record<string, unknown>[]) {
  return render(
    <MemoryRouter>
      <UpcomingAppointments appointments={appointments} />
    </MemoryRouter>,
  );
}

describe('upcoming appointment eligibility', () => {
  it('keeps an acceptance-required request out of upcoming appointments', () => {
    const pendingProfile = appointment();

    renderUpcoming([pendingProfile]);

    expect(screen.queryByText('Paciente de teste')).not.toBeInTheDocument();
  });

  it('shows the same appointment after the accepted response refreshes its status', () => {
    const pendingProfile = appointment();
    const acceptedProfile = {
      ...pendingProfile,
      status: 'accepted',
      consulta_id: 'consulta-1',
    };

    const { rerender } = renderUpcoming([pendingProfile]);
    expect(screen.queryByText('Paciente de teste')).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <UpcomingAppointments appointments={[acceptedProfile]} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Paciente de teste')).toBeInTheDocument();
  });

  it('does not move a request when acceptance fails and its status stays requested', () => {
    const failedAcceptance = appointment({ status: 'pending' });

    renderUpcoming([failedAcceptance]);

    expect(screen.queryByText('Paciente de teste')).not.toBeInTheDocument();
  });

  it.each([
    ['PERFIL', 'accepted'],
    ['PERFIL', 'confirmed'],
    ['priority', 'accepted'],
    ['priority', 'CONFIRMADO'],
  ])('preserves visible %s appointments in %s status', (appointmentType, status) => {
    const acceptedAppointment = appointment({
      appointment_type: appointmentType,
      status,
    });

    renderUpcoming([acceptedAppointment]);

    expect(screen.getByText('Paciente de teste')).toBeInTheDocument();
  });

  it('filters pending entries before applying the card display limit', () => {
    const pendingRequests = Array.from({ length: 5 }, (_, index) => appointment({
      id: `pending-${index}`,
      patient_name: `Pendente ${index}`,
      status: 'SOLICITADO',
      scheduled_datetime: scheduledAt(index + 1),
    }));
    const acceptedAppointment = appointment({
      id: 'accepted-after-pending',
      status: 'accepted',
      scheduled_datetime: scheduledAt(20),
      patient_name: 'Consulta elegível',
    });

    renderUpcoming([...pendingRequests, acceptedAppointment]);

    expect(screen.getByText('Consulta elegível')).toBeInTheDocument();
    expect(screen.queryByText('Pendente 0')).not.toBeInTheDocument();
  });

  it('shows a recoverable section error instead of pretending there are no appointments', () => {
    const onRetry = vi.fn();

    render(
      <MemoryRouter>
        <UpcomingAppointments appointments={[]} error={{ code: 'UPCOMING_APPOINTMENTS_LOOKUP_FAILED' }} onRetry={onRetry} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Não foi possível carregar as próximas consultas.')).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma consulta agendada')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
