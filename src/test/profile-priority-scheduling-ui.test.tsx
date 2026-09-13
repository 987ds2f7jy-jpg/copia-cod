import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { filter } = vi.hoisted(() => ({ filter: vi.fn() }));

vi.mock('@/components/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'patient-auth-id', role: 'patient' } }),
}));

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/client-api/readModels', () => ({
  entities: {
    ProfessionalPublicProfile: { filter },
    AvailabilitySlot: { filter },
    Appointment: { filter },
  },
}));

vi.mock('@/client-api/pricing', () => ({
  quoteServicePricingRequest: vi.fn(),
}));

vi.mock('@/client-api/appointments', () => ({
  createAppointmentRequest: vi.fn(),
}));

vi.mock('@/components/payments/PaymentStep', () => ({
  default: () => null,
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect }: { onSelect: (date: Date) => void }) => (
    <button type="button" data-testid="select-priority-date" onClick={() => onSelect(new Date(2099, 0, 1))}>
      Selecionar data de teste
    </button>
  ),
}));

import AgendamentoPerfil from '@/pages/AgendamentoPerfil';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <MemoryRouter initialEntries={['/AgendamentoPerfil?professional=public-profile-id']}>
      <QueryClientProvider client={queryClient}>
        <AgendamentoPerfil />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('priority profile scheduling UI', () => {
  beforeEach(() => {
    filter.mockImplementation((filters: Record<string, unknown>) => {
      if (filters.id === 'public-profile-id') {
        return Promise.resolve([{
          id: 'public-profile-id',
          professional_profile_id: '20000000-0000-4000-8000-000000000001',
          status: 'approved',
          full_name: 'Profissional Teste',
          specialty: 'Clinico Geral',
          profession: 'Medicina',
          prioritario_ativo: true,
          price_standard: 120,
          price_priority: 180,
        }]);
      }

      return Promise.resolve([]);
    });
  });

  it('offers a direct requested-time input for priority even when normal availability is empty', async () => {
    renderPage();

    await screen.findByRole('heading', { name: /Profissional Teste/ });
    fireEvent.click(screen.getByRole('button', { name: /Prioritária/ }));

    await waitFor(() => {
      expect(document.querySelector('input[type="time"]')).toBeInTheDocument();
    });
    expect(screen.getByText(/A solicitação está sujeita ao aceite do profissional/i)).toBeInTheDocument();
    expect(screen.queryByText('Profissional não configurou disponibilidade ainda.')).not.toBeInTheDocument();
  });

  it('restores the slot-based empty-availability state when switching back to PERFIL', async () => {
    renderPage();

    await screen.findByRole('heading', { name: /Profissional Teste/ });
    fireEvent.click(screen.getByRole('button', { name: /Prioritária/ }));
    await waitFor(() => expect(document.querySelector('input[type="time"]')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Padrão/ }));

    expect(document.querySelector('input[type="time"]')).not.toBeInTheDocument();
    expect(screen.getByText('Profissional não configurou disponibilidade ainda.')).toBeInTheDocument();
  });

  it('clears a priority date/time before returning to PERFIL slot validation', async () => {
    renderPage();

    await screen.findByRole('heading', { name: /Profissional Teste/ });
    fireEvent.click(screen.getByRole('button', { name: /Prioritária/ }));
    fireEvent.click(screen.getByTestId('select-priority-date'));
    fireEvent.change(document.querySelector('input[type="time"]')!, { target: { value: '12:00' } });
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /Padrão/ }));

    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    expect(document.querySelector('input[type="time"]')).not.toBeInTheDocument();
  });
});
