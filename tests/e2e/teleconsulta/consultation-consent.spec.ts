import { test as rdTest, expect, AUTH_STATE } from '../support/fixtures';
import { skipIfNoAuth } from '../support/auth-harness';

const CONSULTATION_ID = '10000000-0000-4000-8000-000000000099';

function consentItem(key: string, title: string, required: boolean) {
  return {
    key,
    title,
    version: '1.0.0',
    effectiveDate: '2026-07-12',
    required,
    decision: null,
    eventVersion: null,
    occurredAt: null,
    isCurrentVersion: false,
    granted: false,
  };
}

async function mockConsentContext(page) {
  await page.route('**/functions/v1/get-teleconsulta-context', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          consultation: {
            id: CONSULTATION_ID,
            patientId: 'patient-e2e',
            patientName: 'Paciente E2E',
            professionalId: 'professional-e2e',
            professionalName: 'Profissional E2E',
            status: 'aguardando',
            consultationType: 'padrao',
          },
          participant: {
            appUserId: 'patient-e2e',
            role: 'patient',
            isParticipant: true,
            canStartSession: false,
            canFinishSession: false,
            canUpsertProntuario: false,
            canSubmitEvaluation: false,
          },
          consents: {
            telemedicine: consentItem('telemedicine_consent', 'Autorização para atendimento por telemedicina', true),
            transcription: consentItem('consultation_transcription_consent', 'Transcrição para apoio ao atendimento', false),
            aiAssistance: consentItem('ai_assistance_notice', 'Aviso de assistência por inteligência artificial', false),
            transcriptionAllowed: false,
            aiAssistanceAllowed: false,
          },
          currentProntuario: null,
          recentProntuarios: [],
          currentEvaluation: null,
          patientSummary: null,
          patientSummaries: [],
          payment: null,
        },
      }),
    });
  });
}

rdTest.describe('consentimento especifico da teleconsulta', () => {
  rdTest.use({ storageState: AUTH_STATE.patient });

  rdTest.beforeEach(async ({ page }, testInfo) => {
    skipIfNoAuth(testInfo, 'patient');
    await mockConsentContext(page);
  });

  rdTest('separa telemedicina, transcricao e IA sem pre-selecionar opcoes', async ({ page, goto }) => {
    await goto(`/consulta/${CONSULTATION_ID}`);
    await expect(page.getByRole('heading', { name: 'Preparação para a teleconsulta' })).toBeVisible();
    await expect(page.getByLabel(/autorizo a realização desta consulta por telemedicina/i)).not.toBeChecked();
    await expect(page.getByLabel('Autorizar transcrição')).not.toBeChecked();
    await expect(page.getByLabel('Continuar sem transcrição')).not.toBeChecked();
    await expect(page.getByRole('button', { name: /confirmar escolhas/i })).toBeDisabled();
  });

  rdTest('recusar transcricao permite confirmar a telemedicina', async ({ page, goto }) => {
    const decisions: Array<{ consentKey: string; decision: string }> = [];
    await page.route('**/functions/v1/record-consultation-consent', async (route) => {
      const body = route.request().postDataJSON();
      decisions.push({ consentKey: body.consentKey, decision: body.decision });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: crypto.randomUUID(), ...body, documentVersion: '1.0.0' } }),
      });
    });

    await goto(`/consulta/${CONSULTATION_ID}`);
    await page.getByLabel(/autorizo a realização desta consulta por telemedicina/i).check();
    await page.getByLabel('Continuar sem transcrição').check();
    await page.getByRole('button', { name: /confirmar escolhas/i }).click();

    await expect.poll(() => decisions.length).toBe(2);
    expect(decisions).toEqual([
      { consentKey: 'consultation_transcription_consent', decision: 'declined' },
      { consentKey: 'telemedicine_consent', decision: 'granted' },
    ]);
  });

  rdTest('permanece legivel em viewport mobile e modo escuro', async ({ page, goto }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await goto(`/consulta/${CONSULTATION_ID}`);
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.getByRole('heading', { name: 'Preparação para a teleconsulta' })).toBeVisible();
    await expect(page.getByText(/A transcrição é opcional/i)).toBeVisible();
  });
});
