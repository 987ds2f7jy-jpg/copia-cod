/**
 * support/page-helpers.ts
 *
 * PROPÓSITO
 *   Helpers de página reutilizáveis que eliminam duplicação entre specs.
 *   Cada função encapsula uma interação comum com a UI real do app,
 *   usando seletores baseados nos componentes Radix/shadcn usados no projeto.
 *
 * REGRAS
 *   - Nunca usa seletores frágeis (CSS class, index, nth).
 *   - Cada helper documenta de qual arquivo de componente vem o seletor.
 *   - Helpers que dependem de dados específicos recebem parâmetros explícitos.
 *   - Sem estado global — cada helper é uma função pura de (page) → Promise.
 */

import { type Page, expect } from '@playwright/test';
import { USERS } from './constants';

// ---------------------------------------------------------------------------
// Menu do usuário (Layout.jsx — DropdownMenu no header)
// O trigger mostra user.full_name.split(' ')[0] || 'Usuário'
// ---------------------------------------------------------------------------

/** Abre o dropdown de usuário no Layout. */
export async function openUserMenu(page: Page) {
  // Localiza o trigger pelo primeiro nome OU fallback 'Usuário'
  const trigger = page
    .locator('header')
    .getByRole('button', { name: /usuário/i })
    .or(
      page.locator('header').getByRole('button', {
        name: new RegExp(
          [USERS.patient.name, USERS.professional.name, USERS.admin.name]
            .map((n) => n.split(' ')[0])
            .join('|'),
          'i',
        ),
      }),
    );
  await trigger.first().click();
}

/** Faz logout via menu do Layout. */
export async function logoutViaMenu(page: Page) {
  await openUserMenu(page);
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await expect(page).toHaveURL('/', { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Calendário (react-day-picker — table[role="grid"])
// Usado em AgendamentoEspecialidade e AgendamentoPerfil
// ---------------------------------------------------------------------------

/** Clica na primeira célula de data habilitada no calendário. */
export async function selectFirstAvailableDate(page: Page): Promise<boolean> {
  await page.waitForSelector('table[role="grid"]', { timeout: 8_000 });
  const enabledDay = page
    .locator('table[role="grid"] button[name]:not([disabled])')
    .first();
  const count = await enabledDay.count();
  if (count === 0) return false;
  await enabledDay.click();
  return true;
}

/** Clica no primeiro slot de horário disponível (botões HH:MM). */
export async function selectFirstAvailableTimeSlot(page: Page): Promise<string | null> {
  const slot = page
    .locator('div.grid button')
    .filter({ hasText: /^\d{2}:\d{2}$/ })
    .first();
  const count = await slot.count();
  if (count === 0) return null;
  const text = await slot.textContent();
  await slot.click();
  return text?.trim() ?? null;
}

// ---------------------------------------------------------------------------
// Dashboard do paciente (DashboardPaciente.jsx)
// ---------------------------------------------------------------------------

/** Aguarda o DashboardPaciente carregar completamente (h1 visível). */
export async function waitForPatientDashboard(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Gerencie suas consultas e agendamentos')).toBeVisible();
}

/** Clica em uma das abas do DashboardPaciente. */
export async function clickDashboardTab(
  page: Page,
  tab: 'proximas' | 'historico' | 'canceladas',
) {
  const labels: Record<typeof tab, RegExp> = {
    proximas:   /próximas/i,
    historico:  /histórico/i,
    canceladas: /canceladas/i,
  };
  await page.getByRole('tab', { name: labels[tab] }).click();
  await expect(page.getByRole('tab', { name: labels[tab] })).toHaveAttribute(
    'aria-selected',
    'true',
  );
}

// ---------------------------------------------------------------------------
// Dashboard do profissional (DashboardProfissional.jsx)
// Tem duas abas internas: "Dashboard" e "Meu Perfil" (botões, não Tabs Radix)
// ---------------------------------------------------------------------------

/** Aguarda o DashboardProfissional carregar (h1 com nome ou fallback). */
export async function waitForProfessionalDashboard(page: Page) {
  await expect(page).toHaveURL(/\/DashboardProfissional/, { timeout: 15_000 });
  await expect(
    page.getByRole('heading', { name: /dr\(a\)\.|painel profissional/i }),
  ).toBeVisible({ timeout: 15_000 });
}

/** Clica na aba interna do DashboardProfissional. */
export async function clickProfessionalTab(
  page: Page,
  tab: 'dashboard' | 'perfil',
) {
  const labels = { dashboard: 'Dashboard', perfil: 'Meu Perfil' };
  // São <button> normais com texto, não Tabs Radix
  await page.getByRole('button', { name: labels[tab], exact: true }).click();
}

// ---------------------------------------------------------------------------
// Perfil do usuário (Perfil.jsx — /Perfil)
// ---------------------------------------------------------------------------

/** Aguarda a página /Perfil carregar (h1 "Meu perfil"). */
export async function waitForPerfilPage(page: Page) {
  await expect(
    page.getByRole('heading', { name: 'Meu perfil' })
  ).toBeVisible({ timeout: 12_000 });
}

/** Preenche um campo do formulário de perfil por id. */
export async function fillPerfilField(page: Page, fieldId: string, value: string) {
  const input = page.locator(`#${fieldId}`);
  await input.clear();
  await input.fill(value);
}

/** Submete o formulário de perfil e aguarda o feedback de sucesso "Salvo!". */
export async function savePerfilAndWait(page: Page) {
  await page.getByRole('button', { name: /salvar alteracoes/i }).click();
  // Perfil.jsx: onSuccess → setSaved(true) → botão muda para "Salvo!" por 3s
  await expect(
    page.getByRole('button', { name: /salvo!/i })
  ).toBeVisible({ timeout: 12_000 });
}
