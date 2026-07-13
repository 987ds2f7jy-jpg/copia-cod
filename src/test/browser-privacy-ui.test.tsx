import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { beforeEach, describe, expect, it } from 'vitest';
import { BrowserPrivacyProvider } from '@/components/privacy/BrowserPrivacyProvider';
import CookiesArmazenamento from '@/pages/CookiesArmazenamento';
import { BROWSER_PRIVACY_PREFERENCES_KEY } from '@/config/browser-storage';

function wrapper(children) {
  const client = new QueryClient();
  return render(
    <ThemeProvider attribute="class" storageKey="rapido-doutor-theme">
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <BrowserPrivacyProvider>{children}</BrowserPrivacyProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe('browser privacy UI', () => {
  beforeEach(() => window.localStorage.clear());

  it('shows equally visible accept, reject and configure actions', async () => {
    wrapper(<div>Aplicacao</div>);
    expect(await screen.findByRole('button', { name: 'Aceitar opcionais' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Rejeitar opcionais' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Configurar' })).toBeVisible();
  });

  it('starts the optional map disabled and necessary storage enabled', async () => {
    wrapper(<div>Aplicacao</div>);
    fireEvent.click(await screen.findByRole('button', { name: 'Configurar' }));
    expect(screen.getByRole('switch', { name: 'Armazenamento estritamente necessario sempre ativo' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Mapa opcional' })).not.toBeChecked();
  });

  it('rejects optional storage without deleting the auth session', async () => {
    window.localStorage.setItem('rd.auth.session.v1', 'preserve-session');
    wrapper(<div>Aplicacao</div>);
    fireEvent.click(await screen.findByRole('button', { name: 'Rejeitar opcionais' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Aceitar opcionais' })).not.toBeInTheDocument());
    expect(window.localStorage.getItem('rd.auth.session.v1')).toBe('preserve-session');
    expect(JSON.parse(window.localStorage.getItem(BROWSER_PRIVACY_PREFERENCES_KEY) || '{}')).toMatchObject({
      necessary: true, preferences: false, analytics: false, marketing: false,
    });
  });

  it('renders the informative page and preference controls', async () => {
    wrapper(<CookiesArmazenamento />);
    expect(screen.getByRole('heading', { name: 'Cookies e armazenamento', level: 1 })).toBeVisible();
    expect(screen.getByText(/nao define cookie proprio/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Configurar armazenamento opcional' })).toBeVisible();
    expect(await screen.findByRole('button', { name: 'Aceitar opcionais' })).toBeVisible();
  });
});
