import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PrivacyRightsPanel from '@/components/privacy/PrivacyRightsPanel';

const api = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  exportData: vi.fn(),
}));

vi.mock('@/client-api/account', () => ({
  createPrivacyRightsRequest: api.create,
  getMyPrivacyRightsRequests: api.list,
  generateMyPrivacyDataExport: api.exportData,
}));

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><PrivacyRightsPanel /></QueryClientProvider>);
}

describe('privacy rights self-service UI', () => {
  beforeEach(() => {
    api.create.mockReset(); api.list.mockReset(); api.exportData.mockReset();
    api.list.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 20, total: 0 } });
  });

  it('distinguishes deactivation from deletion and shows the legal deadline placeholder', async () => {
    renderPanel();
    expect(screen.getByText(/desativar a conta nao equivale a excluir dados/i)).toBeInTheDocument();
    expect(screen.getByText(/validar e definir com responsavel juridico\/privacidade/i)).toBeInTheDocument();
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(1));
  });

  it('submits only canonical self-service fields', async () => {
    api.create.mockResolvedValue({ created: true, request: { id: 'request-1' } });
    renderPanel();
    fireEvent.change(screen.getByLabelText('Detalhes necessarios'), { target: { value: 'Quero consultar os dados associados a minha conta.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitacao' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create.mock.calls[0][0]).toMatchObject({ requestType: 'access', description: 'Quero consultar os dados associados a minha conta.' });
    expect(api.create.mock.calls[0][0]).not.toHaveProperty('userId');
    expect(api.create.mock.calls[0][0]).not.toHaveProperty('status');
  });
});
