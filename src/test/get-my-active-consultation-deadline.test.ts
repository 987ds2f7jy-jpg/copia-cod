import { describe, expect, it, vi } from 'vitest';
import { getMyActiveConsultation } from '../../supabase/functions/get-my-active-consultation/service';
import type { GetMyActiveConsultationRepository } from '../../supabase/functions/get-my-active-consultation/types';

function consultation(id: string, datetime: string) {
  return {
    id,
    paciente_id: 'patient-1',
    paciente_nome: 'Patient',
    paciente_email: null,
    profissional_id: 'professional-1',
    profissional_user_id: 'professional-user',
    profissional_nome: 'Professional',
    especialidade: 'Clinico Geral',
    tipo_consulta: 'padrao',
    status: 'aguardando',
    datetime,
    descricao_sintomas: null,
    inicio_at: null,
    fim_at: null,
    sala_id: null,
    token_sala: null,
    preco: 0,
    created_date: datetime,
  };
}

describe('active consultation deadline selection', () => {
  it('does not let an overdue never-started consultation mask a valid one', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-15T10:00:00.000Z'));
    const repository = {
      findProfessionalIdentityByAppUserId: vi.fn(),
      listActiveConsultationsForPatient: vi.fn().mockResolvedValue([
        consultation('old', '2030-01-13T08:00:00.000Z'),
        consultation('current', '2030-01-15T10:00:00.000Z'),
      ]),
      listActiveConsultationsForProfessional: vi.fn(),
      closeExpiredConsultation: vi.fn(),
      completeAppointmentsByConsultationId: vi.fn(),
      completeQueueEntriesByConsultation: vi.fn(),
    } as unknown as GetMyActiveConsultationRepository;

    const result = await getMyActiveConsultation({
      requestId: 'deadline-selection',
      appUser: { id: 'patient-1', role: 'patient', isActive: true },
      repository,
    });

    expect(result.consultation?.id).toBe('current');
    expect(result.entryEligibility?.canStart).toBe(true);
    vi.useRealTimers();
  });
});
