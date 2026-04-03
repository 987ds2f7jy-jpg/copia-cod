import { describe, expect, it } from 'vitest';
import { buildQuestionCreatePayload, normalizeQuestion } from '@/lib/questions';
import { buildSaquePayload } from '@/lib/saques';
import { canWorkOnDuty, normalizePlantaoSpecialty } from '@/lib/professionals';

describe('professional normalization', () => {
  it('normalizes specialties with accents and aliases for duty flow', () => {
    expect(normalizePlantaoSpecialty('Clínico Geral')).toBe('clinico_geral');
    expect(normalizePlantaoSpecialty('Psicologia Clínica')).toBe('psicologia');
    expect(canWorkOnDuty('Psiquiatria')).toBe(true);
  });
});

describe('question contract adapters', () => {
  it('builds question payload using backend field names', () => {
    expect(buildQuestionCreatePayload({
      user: { id: 'patient-1', full_name: 'Maria' },
      specialty: 'Cardiologia',
      questionText: 'Tenho palpitações?',
    })).toEqual({
      paciente_id: 'patient-1',
      paciente_nome: 'Maria',
      specialty: 'Cardiologia',
      pergunta: 'Tenho palpitações?',
      status: 'PENDENTE',
    });
  });

  it('normalizes backend question rows for the frontend', () => {
    const normalized = normalizeQuestion({
      id: 'q1',
      paciente_id: 'patient-1',
      paciente_nome: 'Maria',
      specialty: 'Cardiologia',
      pergunta: 'Tenho palpitações?',
      resposta: 'Procure avaliação.',
      answered_by_professional_name: 'Dr. João',
      public_profile_id: 'pub-1',
      status: 'RESPONDIDA',
    }, {
      'pub-1': {
        id: 'pub-1',
        specialty: 'Cardiologia',
        photo_url: 'https://example.com/photo.jpg',
      },
    });

    expect(normalized.question_text).toBe('Tenho palpitações?');
    expect(normalized.answer_text).toBe('Procure avaliação.');
    expect(normalized.answered_by_name).toBe('Dr. João');
    expect(normalized.answered_by_specialty).toBe('Cardiologia');
    expect(normalized.answered_by_public_profile_id).toBe('pub-1');
  });
});

describe('saque contract adapters', () => {
  it('builds withdrawal payload compatible with the database schema', () => {
    const payload = buildSaquePayload({
      professionalId: 'prof-1',
      value: 250,
      bankingData: {
        tipo_recebimento: 'PIX',
        tipo_chave_pix: 'EMAIL',
        chave_pix: 'medico@example.com',
      },
    });

    expect(payload.professional_id).toBe('prof-1');
    expect(payload.valor).toBe(250);
    expect(payload.metodo).toBe('PIX');
    expect(payload.observacao).toContain('PIX');
    expect(payload.status).toBe('pendente');
  });
});
