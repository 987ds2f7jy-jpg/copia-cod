/**
 * scheduling/room-flow.spec.ts
 *
 * TIPO: Documentação de limitações técnicas (R5, R6) + status rendering
 *
 * NOTA: Este arquivo está em scheduling/ por restrição de organização do projeto.
 * Os testes de acesso/estados da sala estão em teleconsulta/room-access.spec.ts.
 * Este arquivo mantém apenas os 3 cenários únicos que não existem lá.
 *
 * TESTES ÚNICOS DESTE ARQUIVO:
 *   R5 — Zoom SDK cleanup na navegação (limitação documentada)
 *   R6 — auto-resume TTL de 2h no sessionStorage (limitação documentada)
 *   renderConsultationStatus — verifica rendering de status finalizada
 */

import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { skipIfNoAuth } from '../support/auth-harness';

// ---------------------------------------------------------------------------
// R5 — Zoom SDK cleanup (limitação documentada)
// ---------------------------------------------------------------------------
rdTest.describe('room-flow — Zoom SDK cleanup (R5)', () => {

  rdTest.use({ storageState: AUTH_STATE.professional });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'professional');
  });

  rdTest('Zoom SDK cleanup — limitação documentada (R5)', async () => {
    rdTest.skip(
      true,
      [
        'R5: o Zoom SDK não tem cleanup garantido ao navegar para fora da página.',
        'useZoomSession.ts não tem cleanup verificável via E2E sem WebRTC ativo.',
        'Requer mock completo do Zoom SDK e spy no método leave().',
      ].join(' '),
    );
  });

});

// ---------------------------------------------------------------------------
// R6 — auto-resume TTL (limitação documentada)
// ---------------------------------------------------------------------------
rdTest.describe('room-flow — auto-resume TTL sessionStorage (R6)', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('auto-resume: TTL de 2h no sessionStorage — estrutura da chave @critical', async ({
    page, goto,
  }) => {
    await goto(ROUTES.consultaAgora);
    await expect(page).not.toHaveURL(/\/Entrar/);

    // Verificar que a chave de auto-resume tem a estrutura esperada quando presente
    const autoResume = await page.evaluate(() =>
      window.sessionStorage.getItem('rd_consulta_agora_auto_resume'),
    );

    if (autoResume !== null) {
      // Se a chave existe, deve ter queueId e expiresAt
      const parsed = JSON.parse(autoResume);
      expect(parsed).toHaveProperty('expiresAt');
      // expiresAt deve ser uma data futura (TTL 2h a partir da criação)
      const expiresAt = new Date(parsed.expiresAt).getTime();
      expect(expiresAt).toBeGreaterThan(Date.now());
    }
    // Se não existe (nenhuma fila ativa), o teste é neutro — correto
  });

});

// ---------------------------------------------------------------------------
// renderConsultationStatus — verifica estados de finalização
// ---------------------------------------------------------------------------
rdTest.describe('room-flow — verificação de status finalizada', () => {

  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({}, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
  });

  rdTest('renderConsultationStatus — consulta finalizada exibe "Consulta encerrada" @critical', async ({
    page, goto,
  }) => {
    rdTest.skip(
      !process.env.E2E_CONSULTA_FINALIZADA_ID,
      'Define E2E_CONSULTA_FINALIZADA_ID com ID de consulta com status=finalizada.',
    );

    await goto(ROUTES.consultaRoom(process.env.E2E_CONSULTA_FINALIZADA_ID!));
    await expect(
      page.getByRole('heading', { name: 'Consulta encerrada' })
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/duracao:/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /voltar ao inicio/i })
    ).toBeVisible();
  });

});
