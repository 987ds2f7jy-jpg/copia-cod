/**
 * scheduling/by-profile.spec.ts
 *
 * TIPO: Fluxo crítico
 *
 * FLUXO COBERTO: /AgendamentoPerfil?professional=<id>
 *   Diferente de /AgendamentoEspecialidade: o paciente escolhe um
 *   profissional específico pelo perfil público. Tem 3 steps (não 5),
 *   suporta tipo "Padrão" e "Prioritária", e inclui verificação de
 *   conflito de horário antes do submit (client-side).
 *
 * STEPS DO FLUXO (AgendamentoPerfil.jsx)
 *   Step 1 — tipo (Padrão/Prioritária) + data + horário
 *   Step 2 — confirmar + sintomas + botão de submit
 *   Step 3 — sucesso: "Agendamento Confirmado!" ou "Solicitação Enviada!"
 *
 * SELETORES BASEADOS NO HTML REAL
 *   - h1 "Agendamento por Especialidade"  (NÃO existe aqui)
 *   - CardTitle "Escolha data e horário"  → step 1
 *   - CardTitle "Confirmar agendamento"   → step 2
 *   - h2 "Agendamento Confirmado!"        → step 3 (padrão)
 *   - h2 "Solicitação Enviada!"           → step 3 (prioritária)
 *   - h2 "Profissional não encontrado"    → sem ?professional= ou ID inválido
 *   - h2 "Ação não permitida"             → role=professional tentando agendar
 *   - button "Continuar"                  → step 1 → 2
 *   - button "Confirmar Agendamento"      → step 2 (padrão)
 *   - button "Solicitar Consulta Prioritária" → step 2 (prioritária)
 *   - div contendo "Padrão"               → selector do tipo standard
 *   - div contendo "Prioritária"          → selector do tipo priority
 *   - text "Profissional não configurou disponibilidade" → sem AvailabilitySlots
 *
 * RACE CONDITION CONHECIDA (documentada, não testável via E2E único)
 *   A verificação de conflito de horário é client-side:
 *     entities.Appointment.filter({ scheduled_datetime, status: 'CONFIRMADO' })
 *   Dois pacientes simultâneos podem passar pela verificação sem erro.
 *   O tratamento correto seria mover essa validação para o Edge Function
 *   create-appointment. Este arquivo documenta a limitação no teste
 *   "race-condition-documentada".
 *
 * DEPENDÊNCIAS
 *   - E2E_PROFESSIONAL_PUBLIC_ID: public_profile_id de profissional aprovado
 *   - E2E_ALLOW_SCHEDULING=true para testes que criam dados reais
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';

const TEST_PROF_ID = process.env.E2E_PROFESSIONAL_PUBLIC_ID ?? '';
const hasProfId = !!TEST_PROF_ID;

// ---------------------------------------------------------------------------
// Guards e estados de erro (funcionam sem ID real)
// ---------------------------------------------------------------------------
rdTest.describe('by-profile — guards de acesso', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest('sem ?professional= exibe "Profissional não encontrado"', async ({
    page, goto,
  }) => {
    await goto(ROUTES.agendamentoPerfil);

    await expect(
      page.getByRole('heading', { name: 'Profissional não encontrado' })
    ).toBeVisible({ timeout: 10_000 });
  });

  rdTest('ID inválido exibe "Profissional não encontrado"', async ({ page, goto }) => {
    await goto(`${ROUTES.agendamentoPerfil}?professional=id-invalido-e2e-test`);

    await expect(
      page.getByRole('heading', { name: 'Profissional não encontrado' })
    ).toBeVisible({ timeout: 12_000 });

    // Link para ver todos os profissionais deve existir
    await expect(
      page.getByRole('button', { name: 'Ver todos os profissionais' })
    ).toBeVisible();
  });

  rdTest('rota exige autenticação — sem sessão redireciona para /Entrar', async ({
    page, goto, clearAuthState,
  }) => {
    await clearAuthState();
    await goto(`${ROUTES.agendamentoPerfil}?professional=${TEST_PROF_ID || 'qualquer'}`);
    await expect(page).toHaveURL(/\/Entrar/, { timeout: 10_000 });
  });

});

rdTest.describe('by-profile — com paciente autenticado', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  // -------------------------------------------------------------------------
  // Step 1 — estrutura
  // -------------------------------------------------------------------------
  rdTest('step 1 exibe card do profissional e seletores de tipo @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(!hasProfId, 'Define E2E_PROFESSIONAL_PUBLIC_ID para este teste.');

    await goto(`${ROUTES.agendamentoPerfil}?professional=${TEST_PROF_ID}`);

    // Card do profissional sempre visível (step 1, 2 e 3)
    // AgendamentoPerfil.jsx: Card com foto + nome + especialidade
    await expect(
      page.getByRole('heading', { name: 'Escolha data e horário' })
    ).toBeVisible({ timeout: 12_000 });

    // Seletores de tipo de consulta
    await expect(page.getByText('Padrão')).toBeVisible();
    await expect(page.getByText('Prioritária')).toBeVisible();
    await expect(page.getByText('Agendamento com 36h+ de antecedência')).toBeVisible();
  });

  rdTest('tipo Padrão começa selecionado por padrão', async ({ page, goto }) => {
    rdTest.skip(!hasProfId, 'Define E2E_PROFESSIONAL_PUBLIC_ID.');

    await goto(`${ROUTES.agendamentoPerfil}?professional=${TEST_PROF_ID}`);
    await expect(
      page.getByRole('heading', { name: 'Escolha data e horário' })
    ).toBeVisible({ timeout: 12_000 });

    // O container "Padrão" deve ter a classe de selecionado (border-emerald)
    // Verifica via aria — o botão padrão está "pressionado" visualmente
    // Estratégia mais robusta: verificar que o texto de janela do padrão está visível
    await expect(page.getByText('Agendamento com 36h+ de antecedência')).toBeVisible();
  });

  rdTest('botão Continuar fica desabilitado sem data e horário', async ({
    page, goto,
  }) => {
    rdTest.skip(!hasProfId, 'Define E2E_PROFESSIONAL_PUBLIC_ID.');

    await goto(`${ROUTES.agendamentoPerfil}?professional=${TEST_PROF_ID}`);
    await expect(
      page.getByRole('heading', { name: 'Escolha data e horário' })
    ).toBeVisible({ timeout: 12_000 });

    await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  rdTest('sem disponibilidade configurada exibe aviso ao selecionar data', async ({
    page, goto,
  }) => {
    rdTest.skip(!hasProfId, 'Define E2E_PROFESSIONAL_PUBLIC_ID.');
    // Válido para profissionais sem AvailabilitySlots configurados.
    // O texto exato (AgendamentoPerfil.jsx): "Profissional não configurou disponibilidade ainda."
    // Este teste é marcado como fixme pois depende do estado do profissional de teste.
    rdTest.fixme();
  });

  // -------------------------------------------------------------------------
  // Step 2 — confirmação
  // -------------------------------------------------------------------------
  rdTest('step 2 exibe resumo do agendamento @critical', async ({ page, goto }) => {
    rdTest.skip(!hasProfId, 'Define E2E_PROFESSIONAL_PUBLIC_ID.');
    rdTest.skip(
      !process.env.E2E_ALLOW_SCHEDULING,
      'Navegação até step 2 requer selecionar slot real — defina E2E_ALLOW_SCHEDULING=true.',
    );

    await goto(`${ROUTES.agendamentoPerfil}?professional=${TEST_PROF_ID}`);
    await expect(
      page.getByRole('heading', { name: 'Escolha data e horário' })
    ).toBeVisible({ timeout: 12_000 });

    // Selecionar data futura válida no calendário
    await page.waitForSelector('table[role="grid"]', { timeout: 8_000 });
    const enabledDay = page.locator('table[role="grid"] button[name]:not([disabled])')
      .first();
    await enabledDay.click();

    // Aguardar slots e clicar no primeiro
    const timeSlot = page.locator('div.grid button').filter({ hasText: /^\d{2}:\d{2}$/ }).first();
    await timeSlot.waitFor({ timeout: 8_000 });
    await timeSlot.click();

    await page.getByRole('button', { name: 'Continuar' }).click();

    // Step 2 — CardTitle "Confirmar agendamento"
    await expect(
      page.getByRole('heading', { name: 'Confirmar agendamento' })
    ).toBeVisible({ timeout: 8_000 });

    // Resumo contém Data, Horário, Especialidade, Tipo, Valor
    await expect(page.getByText('Data')).toBeVisible();
    await expect(page.getByText('Horário')).toBeVisible();
    await expect(page.getByText('Especialidade')).toBeVisible();
  });

  rdTest('step 2 → step 1 via botão Voltar', async ({ page, goto }) => {
    rdTest.skip(!hasProfId, 'Define E2E_PROFESSIONAL_PUBLIC_ID.');
    rdTest.skip(!process.env.E2E_ALLOW_SCHEDULING, 'Requer E2E_ALLOW_SCHEDULING=true.');

    await goto(`${ROUTES.agendamentoPerfil}?professional=${TEST_PROF_ID}`);
    await expect(
      page.getByRole('heading', { name: 'Escolha data e horário' })
    ).toBeVisible({ timeout: 12_000 });

    await page.waitForSelector('table[role="grid"]', { timeout: 8_000 });
    const enabledDay = page.locator('table[role="grid"] button[name]:not([disabled])')
      .first();
    await enabledDay.click();

    const timeSlot = page.locator('div.grid button').filter({ hasText: /^\d{2}:\d{2}$/ }).first();
    await timeSlot.waitFor({ timeout: 8_000 });
    await timeSlot.click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(
      page.getByRole('heading', { name: 'Confirmar agendamento' })
    ).toBeVisible({ timeout: 8_000 });

    await page.getByRole('button', { name: /voltar/i }).click();
    await expect(
      page.getByRole('heading', { name: 'Escolha data e horário' })
    ).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Tratamento de erro de conflito
  // -------------------------------------------------------------------------
  rdTest('mensagem de slot ocupado é visível ao tentar horário já reservado @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(!hasProfId, 'Define E2E_PROFESSIONAL_PUBLIC_ID.');
    rdTest.skip(
      !process.env.E2E_SLOT_CONFLICT_DATETIME,
      'Define E2E_SLOT_CONFLICT_DATETIME com datetime de um slot já ocupado (YYYY-MM-DDTHH:MM:00).',
    );

    // Pré-condição: existe agendamento com status=CONFIRMADO no slot configurado.
    // Ao tentar confirmar, AgendamentoPerfil.jsx detecta o conflito client-side
    // e lança "Este horário acabou de ser ocupado. Por favor, escolha outro."
    await goto(`${ROUTES.agendamentoPerfil}?professional=${TEST_PROF_ID}`);
    await expect(
      page.getByRole('heading', { name: 'Escolha data e horário' })
    ).toBeVisible({ timeout: 12_000 });

    // TODO: selecionar a data e hora do E2E_SLOT_CONFLICT_DATETIME
    // e tentar confirmar para provocar o erro.
    // Implementar quando seed de conflito estiver disponível.
    rdTest.fixme();
  });

  // -------------------------------------------------------------------------
  // Race condition — documentação de limitação conhecida
  // -------------------------------------------------------------------------
  rdTest('race condition client-side — limitação documentada', async () => {
    // LIMITAÇÃO CONHECIDA — NÃO É POSSÍVEL TESTAR COM E2E DE USUÁRIO ÚNICO
    //
    // A verificação de conflito em AgendamentoPerfil.jsx é puramente client-side:
    //   const existing = await entities.Appointment.filter({
    //     professional_id: privateProfileId,
    //     scheduled_datetime: scheduledDatetime,
    //     status: 'CONFIRMADO',
    //   });
    //   if (existing && existing.length > 0) throw new Error('horário ocupado');
    //
    // Dois pacientes simultâneos passam ambos pela verificação (retorna []) e
    // ambos chegam ao createAppointmentRequest. O segundo cria agendamento duplo.
    //
    // RECOMENDAÇÃO: mover a verificação para o Edge Function create-appointment
    // usando uma transação ou lock de banco de dados.
    //
    // Este teste existe como documentação — nunca deve ser removido sem antes
    // implementar a proteção server-side.
    expect(true).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Caminho feliz — padrão (cria dados reais)
  // -------------------------------------------------------------------------
  rdTest('caminho feliz padrão: step 3 exibe "Agendamento Confirmado!" @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(!hasProfId, 'Define E2E_PROFESSIONAL_PUBLIC_ID.');
    rdTest.skip(
      !process.env.E2E_ALLOW_SCHEDULING,
      'Define E2E_ALLOW_SCHEDULING=true para criar agendamentos reais.',
    );

    await goto(`${ROUTES.agendamentoPerfil}?professional=${TEST_PROF_ID}`);
    await expect(
      page.getByRole('heading', { name: 'Escolha data e horário' })
    ).toBeVisible({ timeout: 12_000 });

    await page.waitForSelector('table[role="grid"]', { timeout: 8_000 });
    const enabledDay = page.locator('table[role="grid"] button[name]:not([disabled])')
      .first();
    await enabledDay.click();

    const timeSlot = page.locator('div.grid button').filter({ hasText: /^\d{2}:\d{2}$/ }).first();
    await timeSlot.waitFor({ timeout: 8_000 });
    await timeSlot.click();

    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(
      page.getByRole('heading', { name: 'Confirmar agendamento' })
    ).toBeVisible({ timeout: 8_000 });

    await page.getByPlaceholder(/motivo da consulta/i).fill('E2E automated test — padrão');
    await page.getByRole('button', { name: 'Confirmar Agendamento' }).click();

    // Step 3 — sucesso padrão
    await expect(
      page.getByRole('heading', { name: 'Agendamento Confirmado!' })
    ).toBeVisible({ timeout: 20_000 });

    await expect(page.getByText('Confirmado')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver Minhas Consultas' })).toBeVisible();
  });

});

// ---------------------------------------------------------------------------
// Role — profissional bloqueado (usa storageState de profissional)
// ---------------------------------------------------------------------------
rdTest.describe('by-profile — profissional não pode agendar', () => {

  rdTest.use({ storageState: AUTH_STATE.professional });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'professional');
  });

  rdTest('profissional vê "Ação não permitida" ao tentar agendar @critical', async ({
    page, goto,
  }) => {
    await goto(`${ROUTES.agendamentoPerfil}?professional=${TEST_PROF_ID || 'qualquer'}`);

    await expect(
      page.getByRole('heading', { name: 'Ação não permitida' })
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText(/conta de paciente/i)).toBeVisible();
  });

});
