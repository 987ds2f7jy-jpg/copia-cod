import { describe, expect, it, vi } from 'vitest';
import { getTeleconsultaContext } from '../../supabase/functions/get-teleconsulta-context/service';
import type { GetTeleconsultaContextRepository } from '../../supabase/functions/get-teleconsulta-context/types';

const professionalUser = {
  id: '10000000-0000-4000-8000-000000000001',
  authUserId: 'auth-professional',
  fullName: 'Professional',
  email: 'professional@example.invalid',
  role: 'professional',
  isActive: true,
};
const patientId = '20000000-0000-4000-8000-000000000001';
const otherPatientId = '20000000-0000-4000-8000-000000000002';

function createRepository(overrides: Partial<GetTeleconsultaContextRepository> = {}) {
  return {
    findAppUserByAuthUserId: vi.fn().mockResolvedValue(professionalUser),
    findProfessionalIdentityByAppUserId: vi.fn().mockResolvedValue({
      profileId: '30000000-0000-4000-8000-000000000001',
      profileIds: ['30000000-0000-4000-8000-000000000001'],
      appUserId: professionalUser.id,
      fullName: 'Professional',
      specialty: 'Clinico Geral',
      source: 'professional_profiles',
    }),
    listAuthorizedPatientIdsForProfessional: vi.fn().mockResolvedValue([patientId]),
    findPatientById: vi.fn().mockResolvedValue({
      id: patientId,
      full_name: 'Patient',
      birth_date: null,
      sex: null,
    }),
    listPatientProntuarios: vi.fn().mockResolvedValue([]),
    listPatientsByIds: vi.fn().mockResolvedValue([]),
    listLatestProntuariosByPatientIds: vi.fn().mockResolvedValue([]),
    findConsultationById: vi.fn(),
    findPaymentOwnerByConsultationId: vi.fn(),
    closeExpiredConsultation: vi.fn(),
    completeAppointmentsByConsultationId: vi.fn(),
    completeQueueEntriesByConsultation: vi.fn(),
    findProntuarioByConsultationId: vi.fn(),
    findConsultaEvaluation: vi.fn(),
    ...overrides,
  } as unknown as GetTeleconsultaContextRepository;
}

function callService(repository: GetTeleconsultaContextRepository, input: Record<string, unknown>) {
  return getTeleconsultaContext({
    requestId: 'request-1',
    input: {
      consultationId: null,
      patientId: null,
      patientIds: [],
      historyLimit: 20,
      excludeConsultationId: null,
      ...input,
    },
    authenticatedUser: { authUserId: 'auth-professional', email: null },
    repository,
  });
}

describe('teleconsulta clinical history authorization', () => {
  it('allows a professional with a verified care relationship', async () => {
    const repository = createRepository();
    const result = await callService(repository, { patientId });

    expect(result.patientSummary?.id).toBe(patientId);
    expect(repository.listAuthorizedPatientIdsForProfessional).toHaveBeenCalledWith(
      expect.objectContaining({ patientIds: [patientId] }),
    );
  });

  it('rejects an unrelated professional and arbitrary patient UUID', async () => {
    const repository = createRepository({
      listAuthorizedPatientIdsForProfessional: vi.fn().mockResolvedValue([]),
    });

    await expect(callService(repository, { patientId: otherPatientId })).rejects.toMatchObject({
      status: 403,
      code: 'CLINICAL_HISTORY_ACCESS_FORBIDDEN',
    });
    expect(repository.findPatientById).not.toHaveBeenCalled();
  });

  it('rejects a batch containing any unauthorized patient', async () => {
    const repository = createRepository({
      listAuthorizedPatientIdsForProfessional: vi.fn().mockResolvedValue([patientId]),
    });

    await expect(callService(repository, { patientIds: [patientId, otherPatientId] })).rejects.toMatchObject({
      status: 403,
      code: 'CLINICAL_HISTORY_ACCESS_FORBIDDEN',
    });
    expect(repository.listPatientsByIds).not.toHaveBeenCalled();
  });

  it('does not let a patient request another patient clinical history', async () => {
    const repository = createRepository({
      findAppUserByAuthUserId: vi.fn().mockResolvedValue({
        ...professionalUser,
        id: patientId,
        role: 'patient',
      }),
    });

    await expect(callService(repository, { patientId: otherPatientId })).rejects.toMatchObject({
      status: 403,
      code: 'CLINICAL_HISTORY_ACCESS_FORBIDDEN',
    });
  });
});
