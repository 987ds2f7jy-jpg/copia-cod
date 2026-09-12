import { describe, expect, it, vi } from 'vitest';
import { startConsultaSession } from '../../supabase/functions/start-consulta-session/service';
import type { StartConsultaSessionRepository } from '../../supabase/functions/start-consulta-session/types';

function createRepository(datetime: string, tipoConsulta = 'padrao') {
  return {
    findAppUserByAuthUserId: vi.fn().mockResolvedValue({
      id: 'professional-user',
      role: 'professional',
      isActive: true,
    }),
    findConsultationById: vi.fn().mockResolvedValue({
      id: 'consulta-1',
      paciente_id: 'patient-user',
      paciente_nome: 'Paciente',
      paciente_email: null,
      profissional_id: 'professional-profile',
      profissional_user_id: 'professional-user',
      profissional_nome: 'Profissional',
      especialidade: 'Clinico Geral',
      tipo_consulta: tipoConsulta,
      status: 'aguardando',
      datetime,
      descricao_sintomas: null,
      inicio_at: null,
      fim_at: null,
      sala_id: null,
      token_sala: null,
      preco: 0,
    }),
    findProfessionalIdentityByAppUserId: vi.fn().mockResolvedValue({
      profileId: 'professional-profile',
      profileIds: ['professional-profile'],
      appUserId: 'professional-user',
      fullName: 'Profissional',
      specialty: 'Clinico Geral',
      source: 'professional_profiles',
    }),
    requireTelemedicineConsent: vi.fn(),
    findAppointmentByConsultationId: vi.fn(),
    findQueueEntryByConsultation: vi.fn(),
    startConsultationSessionAtomically: vi.fn(),
    updateAppointmentStatus: vi.fn(),
    updateQueueStatus: vi.fn(),
  } as unknown as StartConsultaSessionRepository;
}

describe('scheduled consultation start guard', () => {
  it('does not allow a professional to start a scheduled consultation before its time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-15T10:00:00.000Z'));
    const repository = createRepository('2030-01-15T10:01:00.000Z');

    await expect(startConsultaSession({
      requestId: 'request-1',
      input: { consultationId: 'consulta-1' },
      authenticatedUser: { authUserId: 'auth-professional' },
      repository,
    })).rejects.toMatchObject({
      status: 409,
      code: 'CONSULTATION_START_TOO_EARLY',
    });

    expect(repository.requireTelemedicineConsent).not.toHaveBeenCalled();
    expect(repository.startConsultationSessionAtomically).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('rejects a never-started consultation strictly after the thirty-minute deadline', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-15T10:30:00.001Z'));
    const repository = createRepository('2030-01-15T10:00:00.000Z');

    await expect(startConsultaSession({
      requestId: 'request-late',
      input: { consultationId: 'consulta-1' },
      authenticatedUser: { authUserId: 'auth-professional' },
      repository,
    })).rejects.toMatchObject({
      status: 409,
      code: 'CONSULTATION_START_DEADLINE_ELAPSED',
    });

    expect(repository.startConsultationSessionAtomically).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('keeps the deadline inclusive', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-15T10:30:00.000Z'));
    const repository = createRepository('2030-01-15T10:00:00.000Z');
    repository.requireTelemedicineConsent.mockResolvedValue({ telemedicine: { granted: true } });
    repository.startConsultationSessionAtomically.mockResolvedValue({
      ...(await repository.findConsultationById()),
      status: 'em_atendimento',
      inicio_at: '2030-01-15T10:30:00.000Z',
      sala_id: 'room',
      token_sala: 'token',
    });

    await expect(startConsultaSession({
      requestId: 'request-at-deadline',
      input: { consultationId: 'consulta-1' },
      authenticatedUser: { authUserId: 'auth-professional' },
      repository,
    })).resolves.toMatchObject({ started: true });

    expect(repository.startConsultationSessionAtomically).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
