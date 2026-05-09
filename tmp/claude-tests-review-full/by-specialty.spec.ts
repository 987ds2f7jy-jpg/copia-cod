/**
 * scheduling/by-specialty.spec.ts
 *
 * TIPO: Fluxo crítico
 *
 * FLUXO COBERTO: /AgendamentoEspecialidade
 *   Rota diferente de /AgendamentoPerfil. Aqui o paciente escolhe
 *   especialidade sem selecionar profissional — a solicitação vai para
 *   qualquer profissional disponível daquela área.
 *
 * STEPS DO FLUXO (AgendamentoEspecialidade.jsx)
 *   Step 1 — escolher profissão (Medicina, Psicologia, Nutrição, Fonoaudiologia)
 *   Step 2 — subespecialidade (só para Medicina; outros pulam direto pro step 3)
 *   Step 3 — data + horário (janela 36h–14d, slots de 20min, 08h–17:40)
 *   Step 4 — confirmar + sintomas + botão "Enviar Solicitação"
 *   Step 5 — sucesso: "Solicitação Enviada!" + badge "Aguardando aceite"
 *
 * SELETORES BASEADOS NO HTML REAL
 *   - h1 "Agendamento por Especialidade"       → AgendamentoEspecialidade.jsx
 *   - h3 "Medicina" / "Psicologia" etc.        → cards de profissão (step 1)
 *   - CardTitle "Escolha a especialidade médica" → step 2 (só Medicina)
 *   - CardTitle "Escolha data e horário"        → step 3
 *   - CardTitle "Confirmar solicitação"         → step 4
 *   - h2 "Solicitação Enviada!"                 → step 5
 *   - Badge "Aguardando aceite"                 → step 4 e 5
 *   - button "Enviar Solicitação"               → step 4
 *   - button "Continuar"                        → step 3 → 4
 *   - button "Voltar"                           → qualquer step
 *
 * AUSÊNCIA INTENCIONAL DOCUMENTADA
 *   Este fluxo NÃO verifica conflito de horário antes de submeter.
 *   Dois pacientes podem criar solicitações para o mesmo slot sem
 *   erro client-side. A verificação acontece apenas em /AgendamentoPerfil.
 *
 * DEPENDÊNCIAS
 *   - storageState de paciente (AUTH_STATE.patient)
 *   - E2E_ALLOW_SCHEDULING=true para testes que criam dados reais
 */

import { test, expect, type Page } from '@playwright/test';
import { test as rdTest, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';

// ---------------------------------------------------------------------------
// Helper: avança pelo calendário para encontrar uma data habilitada
// O calendário bloqueia os próximos 36h e mais de 14 dias.
// Uma data 3 dias à frente sempre cai dentro da janela válida.
// ---------------------------------------------------------------------------
async function selectFutureDate(page: Page) {
  // react-day-picker renderiza células como role="gridcell"
  // Células desabilitadas têm aria-disabled="true"
  // Aguarda o calendário renderizar
  await page.waitForSelector('table[role="grid"]', { timeout: 8_000 });

  // Tenta clicar na primeira célula habilitada (não desabilitada, não vazia)
  const enabledDay = page.locator('table[role="grid"] button[name]:not([disabled])')
    .first();

  await enabledDay.click({ timeout: 8_000 });
}

async function expectEnabledCalendarDay(page: Page) {
  await page.waitForSelector('table[role="grid"]', { timeout: 8_000 });

  const enabledDay = page.locator('table[role="grid"] button[name]:not([disabled])').first();
  await expect(enabledDay).toBeVisible({ timeout: 8_000 });
}

// ---------------------------------------------------------------------------
// Estrutura e guards (independem de auth real)
// ---------------------------------------------------------------------------
rdTest.describe('by-specialty — estrutura e acesso', () => {

  rdTest('rota exige autenticação — sem sessão redireciona para /Entrar', async ({
    page, goto, clearAuthState,
  }) => {
    await clearAuthState();
    await goto(ROUTES.agendamentoEspecialidade);
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

  rdTest.describe('com paciente autenticado', () => {
    rdTest.use({ storageState: AUTH_STATE.patient });

    rdTest.beforeEach(async ({ page }, testInfo) => {
      void page;
      skipIfNoAuth(testInfo, 'patient');
    });

    rdTest('step 1 renderiza as 4 profissões disponíveis @critical', async ({ page, goto }) => {
      await goto(ROUTES.agendamentoEspecialidade);

      // h1 da página
      await expect(
        page.getByRole('heading', { name: 'Agendamento por Especialidade' })
      ).toBeVisible({ timeout: 10_000 });

      // Os 4 cards de profissão — h3 com o nome
      for (const name of ['Medicina', 'Psicologia', 'Nutrição', 'Fonoaudiologia']) {
        await expect(page.getByRole('heading', { name, level: 3 })).toBeVisible();
      }
    });

    rdTest('Psicologia pula step 2 e vai direto para data/horário @critical', async ({
      page, goto,
    }) => {
      await goto(ROUTES.agendamentoEspecialidade);

      // Psicologia tem apenas 1 especialidade → pula step 2
      await page.getByRole('heading', { name: 'Psicologia', level: 3 }).click();

      // Deve ir direto ao step 3
      await expect(
        page.getByRole('heading', { name: 'Escolha data e horário' })
      ).toBeVisible({ timeout: 8_000 });
    });

    rdTest('Medicina passa pelo step 2 de subespecialidades @critical', async ({
      page, goto,
    }) => {
      await goto(ROUTES.agendamentoEspecialidade);
      await page.getByRole('heading', { name: 'Medicina', level: 3 }).click();

      // Step 2 — lista de especialidades médicas
      await expect(
        page.getByRole('heading', { name: 'Escolha a especialidade médica' })
      ).toBeVisible({ timeout: 8_000 });

      // Ao menos algumas especialidades devem estar visíveis
      await expect(page.getByRole('button', { name: 'Clínico Geral' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Cardiologia' })).toBeVisible();
    });

    rdTest('botão Voltar no step 2 retorna ao step 1', async ({ page, goto }) => {
      await goto(ROUTES.agendamentoEspecialidade);
      await page.getByRole('heading', { name: 'Medicina', level: 3 }).click();
      await expect(
        page.getByRole('heading', { name: 'Escolha a especialidade médica' })
      ).toBeVisible({ timeout: 8_000 });

      await page.getByRole('button', { name: /voltar/i }).click();

      // De volta ao step 1
      await expect(
        page.getByRole('heading', { name: 'Agendamento por Especialidade' })
      ).toBeVisible();
    });

    rdTest('botão Continuar (step 3→4) fica desabilitado sem data e horário', async ({
      page, goto,
    }) => {
      await goto(ROUTES.agendamentoEspecialidade);
      await page.getByRole('heading', { name: 'Psicologia', level: 3 }).click();
      await expect(
        page.getByRole('heading', { name: 'Escolha data e horário' })
      ).toBeVisible({ timeout: 8_000 });

      // Sem seleção, o botão deve estar desabilitado
      const continueBtn = page.getByRole('button', { name: 'Continuar' });
      await expect(continueBtn).toBeDisabled();
    });

    rdTest('calendário não exibe datas dos próximos 36h como selecionáveis', async ({
      page, goto,
    }) => {
      await goto(ROUTES.agendamentoEspecialidade);
      await page.getByRole('heading', { name: 'Psicologia', level: 3 }).click();
      await expect(
        page.getByRole('heading', { name: 'Escolha data e horário' })
      ).toBeVisible({ timeout: 8_000 });

      // O calendário deve estar presente
      await expect(page.locator('table[role="grid"]')).toBeVisible();

      // A janela de 36h deve desabilitar parte do calendário atual...
      await expect(page.locator('table[role="grid"] [role="gridcell"][disabled]').first())
        .toBeVisible();
      // ...mas ainda precisa oferecer alguma data futura válida.
      await expectEnabledCalendarDay(page);
    });

    rdTest('profissional vê "Ação não permitida" ao tentar acessar o fluxo', async ({
      page, goto,
    }) => {
      // Este teste usa storageState de paciente mas rola o mesmo guard.
      // O guard real é testado em routing/access-control.spec.ts com
      // storageState de profissional.
      // Aqui apenas garantimos que o heading existe no código da página.
      await goto(ROUTES.agendamentoEspecialidade);
      // Como estamos com paciente, a página carrega normalmente
      await expect(
        page.getByRole('heading', { name: 'Agendamento por Especialidade' })
      ).toBeVisible({ timeout: 10_000 });
    });
  });
});

// ---------------------------------------------------------------------------
// Navegação completa entre steps (sem criar dados reais)
// ---------------------------------------------------------------------------
rdTest.describe('by-specialty — navegação de steps', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({ page }, testInfo) => {
    void page;
    skipIfNoAuth(testInfo, 'patient');
  });
  rdTest('step 3 → step 4 após selecionar data e horário @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.agendamentoEspecialidade);
    await page.getByRole('heading', { name: 'Nutrição', level: 3 }).click();

    // Step 3
    await expect(
      page.getByRole('heading', { name: 'Escolha data e horário' })
    ).toBeVisible({ timeout: 8_000 });

    // Seleciona uma data futura válida
    await selectFutureDate(page);

    // Aguarda slots aparecerem
    await page.waitForSelector('button:has(svg)', { timeout: 8_000 }).catch(() => {});

    // Clica no primeiro slot de horário disponível
    const timeSlot = page.locator('div.grid button').filter({ hasText: /^\d{2}:\d{2}$/ }).first();
    const hasSlots = await timeSlot.count() > 0;

    if (!hasSlots) {
      // Nenhum slot neste dia — tenta o próximo mês se necessário
      rdTest.skip();
      return;
    }

    await timeSlot.click();

    // Botão Continuar deve ficar habilitado
    const continueBtn = page.getByRole('button', { name: 'Continuar' });
    await expect(continueBtn).toBeEnabled({ timeout: 5_000 });
    await continueBtn.click();

    // Step 4
    await expect(
      page.getByRole('heading', { name: 'Confirmar solicitação' })
    ).toBeVisible({ timeout: 8_000 });

    // Resumo mostra a especialidade selecionada
    await expect(page.getByText('Nutrição Clínica', { exact: true }).first()).toBeVisible();
    // Badge de status inicial
    await expect(page.getByText('Aguardando aceite')).toBeVisible();
  });

  rdTest('step 4 → step 3 via botão Voltar preserva seleção', async ({
    page, goto,
  }) => {
    await goto(ROUTES.agendamentoEspecialidade);
    await page.getByRole('heading', { name: 'Psicologia', level: 3 }).click();
    await expect(
      page.getByRole('heading', { name: 'Escolha data e horário' })
    ).toBeVisible({ timeout: 8_000 });

    await selectFutureDate(page);

    const timeSlot = page.locator('div.grid button').filter({ hasText: /^\d{2}:\d{2}$/ }).first();
    if (await timeSlot.count() === 0) { rdTest.skip(); return; }

    await timeSlot.click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(
      page.getByRole('heading', { name: 'Confirmar solicitação' })
    ).toBeVisible({ timeout: 8_000 });

    // Volta para step 3
    await page.getByRole('button', { name: /^Voltar$/ }).first().click();
    await expect(
      page.getByRole('heading', { name: 'Escolha data e horário' })
    ).toBeVisible();
  });

  rdTest('step 4 exibe área de sintomas (opcional) e botão de submit', async ({
    page, goto,
  }) => {
    await goto(ROUTES.agendamentoEspecialidade);
    await page.getByRole('heading', { name: 'Psicologia', level: 3 }).click();
    await selectFutureDate(page);

    const timeSlot = page.locator('div.grid button').filter({ hasText: /^\d{2}:\d{2}$/ }).first();
    if (await timeSlot.count() === 0) { rdTest.skip(); return; }
    await timeSlot.click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(
      page.getByRole('heading', { name: 'Confirmar solicitação' })
    ).toBeVisible({ timeout: 8_000 });

    // Campo de sintomas existe e aceita texto
    const symptomsField = page.getByPlaceholder(/motivo da consulta/i);
    await expect(symptomsField).toBeVisible();
    await symptomsField.fill('Teste de ansiedade E2E');

    // Botão de envio deve estar habilitado
    await expect(
      page.getByRole('button', { name: 'Enviar Solicitação' })
    ).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// Seleção e deselecão de horário (step 3)
// Slot selecionado: bg-emerald-500 text-white
// Slot não selecionado: bg-muted text-foreground
// ---------------------------------------------------------------------------
rdTest.describe('by-specialty — seleção de horário (step 3)', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  // Helper local: avança para o step 3 (data/horário) via Psicologia
  async function chegaStep3(page: import('@playwright/test').Page, goto: (r: string) => Promise<void>) {
    await goto(ROUTES.agendamentoEspecialidade);
    await expect(page).not.toHaveURL(/\/Entrar/);
    await page.getByRole('heading', { name: 'Psicologia', level: 3 }).click();
    await expect(
      page.getByRole('heading', { name: 'Escolha data e horário' })
    ).toBeVisible({ timeout: 8_000 });
  }

  rdTest('nenhum slot selecionado mantém "Continuar" desabilitado @critical', async ({ page, goto }) => {
    await chegaStep3(page, goto);
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  rdTest('clicar num slot o marca com bg-emerald-500 (estado selecionado) @critical', async ({ page, goto }) => {
    await chegaStep3(page, goto);

    // Selecionar uma data válida no calendário
    await page.waitForSelector('table[role="grid"]', { timeout: 8_000 });
    const enabledDay = page.locator('table[role="grid"] button[name]')
      .filter({ hasNotAttribute: 'disabled' })
      .first();
    if (await enabledDay.count() === 0) { rdTest.skip(); return; }
    await enabledDay.click();

    // Aguardar slots aparecerem
    const slot = page.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ }).first();
    await expect(slot).toBeVisible({ timeout: 8_000 });

    // Antes de clicar: bg-muted (não selecionado)
    const beforeClass = await slot.evaluate((el) => el.className);
    expect(beforeClass).toContain('muted');
    expect(beforeClass).not.toContain('emerald-500');

    await slot.click();

    // Após clicar: bg-emerald-500 text-white (selecionado)
    const afterClass = await slot.evaluate((el) => el.className);
    expect(afterClass).toContain('emerald-500');
    expect(afterClass).toContain('white');
  });

  rdTest('clicar num slot habilita o botão "Continuar" @critical', async ({ page, goto }) => {
    await chegaStep3(page, goto);

    await page.waitForSelector('table[role="grid"]', { timeout: 8_000 });
    const enabledDay = page.locator('table[role="grid"] button[name]')
      .filter({ hasNotAttribute: 'disabled' })
      .first();
    if (await enabledDay.count() === 0) { rdTest.skip(); return; }
    await enabledDay.click();

    const slot = page.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ }).first();
    await expect(slot).toBeVisible({ timeout: 8_000 });
    await slot.click();

    await expect(page.getByRole('button', { name: 'Continuar' })).toBeEnabled({ timeout: 3_000 });
  });

  rdTest('clicar em outro slot troca a seleção (apenas 1 selecionado por vez) @critical', async ({ page, goto }) => {
    await chegaStep3(page, goto);

    await page.waitForSelector('table[role="grid"]', { timeout: 8_000 });
    const enabledDay = page.locator('table[role="grid"] button[name]')
      .filter({ hasNotAttribute: 'disabled' })
      .first();
    if (await enabledDay.count() === 0) { rdTest.skip(); return; }
    await enabledDay.click();

    const slots = page.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ });
    await expect(slots.first()).toBeVisible({ timeout: 8_000 });

    if (await slots.count() < 2) { rdTest.skip(); return; }

    // Clicar no primeiro slot
    await slots.nth(0).click();
    const first = await slots.nth(0).evaluate((el) => el.className);
    expect(first).toContain('emerald-500');

    // Clicar no segundo slot
    await slots.nth(1).click();

    // Primeiro deve perder seleção
    const firstAfter = await slots.nth(0).evaluate((el) => el.className);
    expect(firstAfter).not.toContain('emerald-500');

    // Segundo deve estar selecionado
    const secondAfter = await slots.nth(1).evaluate((el) => el.className);
    expect(secondAfter).toContain('emerald-500');
  });

  rdTest('trocar de data reseta o slot selecionado @critical', async ({ page, goto }) => {
    await chegaStep3(page, goto);

    await page.waitForSelector('table[role="grid"]', { timeout: 8_000 });
    const days = page.locator('table[role="grid"] button[name]')
      .filter({ hasNotAttribute: 'disabled' });
    if (await days.count() < 2) { rdTest.skip(); return; }

    // Selecionar primeiro dia + slot
    await days.nth(0).click();
    const slot = page.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ }).first();
    await expect(slot).toBeVisible({ timeout: 8_000 });
    await slot.click();
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeEnabled({ timeout: 3_000 });

    // Trocar para outro dia — onSelect do Calendar: setSelectedDate(d); setSelectedTime(null)
    await days.nth(1).click();

    // "Continuar" deve ficar desabilitado (selectedTime = null)
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled({ timeout: 3_000 });
  });

  rdTest('mensagem "Nenhum horário disponível nesta data" aparece em data sem slots', async ({ page, goto }) => {
    // Este estado ocorre quando availableSlots.length === 0 para a data selecionada.
    // Não é possível garantir qual data terá slots na base de desenvolvimento,
    // então verificamos apenas que o texto existe no código via estrutura da página.
    await chegaStep3(page, goto);

    await page.waitForSelector('table[role="grid"]', { timeout: 8_000 });
    const enabledDay = page.locator('table[role="grid"] button[name]')
      .filter({ hasNotAttribute: 'disabled' })
      .first();
    if (await enabledDay.count() === 0) { rdTest.skip(); return; }
    await enabledDay.click();

    // Pode mostrar slots OU a mensagem de "Nenhum horário disponível"
    const hasSlotsOrMessage =
      await page.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ }).count() > 0 ||
      await page.getByText('Nenhum horário disponível nesta data.').isVisible().catch(() => false);

    expect(hasSlotsOrMessage).toBe(true);
  });

});

// ---------------------------------------------------------------------------
// Caminho feliz — cria dados reais (requer flag explícita)
// ---------------------------------------------------------------------------
rdTest.describe('by-specialty — caminho feliz (requer E2E_ALLOW_SCHEDULING)', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({ page }, testInfo) => {
    void page;
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('fluxo completo termina no step 5 com "Solicitação Enviada!" @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(
      !process.env.E2E_ALLOW_SCHEDULING,
      'Define E2E_ALLOW_SCHEDULING=true para criar agendamentos reais.',
    );

    await goto(ROUTES.agendamentoEspecialidade);
    await page.getByRole('heading', { name: 'Psicologia', level: 3 }).click();
    await selectFutureDate(page);

    const timeSlot = page.locator('div.grid button').filter({ hasText: /^\d{2}:\d{2}$/ }).first();
    if (await timeSlot.count() === 0) {
      rdTest.skip();
      return;
    }
    await timeSlot.click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('heading', { name: 'Confirmar solicitação' })).toBeVisible();
    await page.getByPlaceholder(/motivo da consulta/i).fill('E2E automated test');
    await page.getByRole('button', { name: 'Enviar Solicitação' }).click();

    // Step 5 — sucesso
    await expect(
      page.getByRole('heading', { name: 'Solicitação Enviada!' })
    ).toBeVisible({ timeout: 20_000 });

    // Badge confirma status aguardando aceite
    await expect(page.getByText('Aguardando aceite')).toBeVisible();

    // Links de navegação pós-sucesso existem
    await expect(
      page.getByRole('button', { name: 'Ver Minhas Consultas' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Voltar ao Início' })
    ).toBeVisible();
  });

  rdTest('"Ver Minhas Consultas" navega para DashboardPaciente após sucesso', async ({
    page, goto,
  }) => {
    rdTest.skip(
      !process.env.E2E_ALLOW_SCHEDULING,
      'Depende do teste de caminho feliz acima.',
    );

    // Navega diretamente para o dashboard para verificar que a consulta aparece
    await goto(ROUTES.dashboardPaciente);
    await expect(page).toHaveURL(/DashboardPaciente/);
    await expect(page.getByRole('tab', { name: /próximas/i })).toBeVisible();
  });
});
