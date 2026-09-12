import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getProfessionalDashboardRequest: vi.fn(),
}));

vi.mock('@/components/AuthContext', () => ({
  isLogoutRedirectInProgress: () => false,
  useAuth: () => ({
    user: { id: 'auth-professional-1', role: 'professional' },
    loading: false,
    isAuthenticated: true,
    redirectToLogin: vi.fn(),
  }),
}));

vi.mock('@/client-api/professionalDashboard', () => ({
  getProfessionalDashboardRequest: mocks.getProfessionalDashboardRequest,
}));

vi.mock('@/hooks/useMyActiveConsultation', () => ({
  useMyActiveConsultation: () => ({ data: null }),
}));

import DashboardProfissional from '@/pages/DashboardProfissional';

describe('professional dashboard error state', () => {
  it('does not present a backend failure as an absent professional profile', async () => {
    mocks.getProfessionalDashboardRequest.mockRejectedValueOnce(new Error('UPCOMING_APPOINTMENTS_LOOKUP_FAILED'));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <DashboardProfissional />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Não foi possível carregar seu dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Perfil profissional não encontrado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Completar Cadastro' })).not.toBeInTheDocument();
  });
});
