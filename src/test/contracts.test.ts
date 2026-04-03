import { describe, expect, it } from 'vitest';
import { getConsultaParticipantIds, isConsultaParticipant, sanitizeConsultaPayloadForSchema } from '@/lib/consultas';
import { buildQuestionCreatePayload, normalizeQuestion } from '@/lib/questions';
import { buildSaquePayload } from '@/lib/saques';
import { canWorkOnDuty, normalizePlantaoSpecialty } from '@/lib/professionals';
import {
  buildConsultaRoomPayload,
  buildZoomDisplayName,
  buildZoomSessionKey,
  buildZoomSessionName,
  buildZoomUserIdentity,
  getZoomSdkRole,
} from '@/lib/zoom';

describe('professional normalization', () => {
  it('normalizes specialties with accents and aliases for duty flow', () => {
    expect(normalizePlantaoSpecialty('ClÃ­nico Geral')).toBe('clinico_geral');
    expect(normalizePlantaoSpecialty('Psicologia ClÃ­nica')).toBe('psicologia');
    expect(canWorkOnDuty('Psiquiatria')).toBe(true);
  });
});

describe('question contract adapters', () => {
  it('builds question payload using backend field names', () => {
    expect(buildQuestionCreatePayload({
      user: { id: 'patient-1', full_name: 'Maria' },
      specialty: 'Cardiologia',
      questionText: 'Tenho palpitaÃ§Ãµes?',
    })).toEqual({
      paciente_id: 'patient-1',
      paciente_nome: 'Maria',
      specialty: 'Cardiologia',
      pergunta: 'Tenho palpitaÃ§Ãµes?',
      status: 'PENDENTE',
    });
  });

  it('normalizes backend question rows for the frontend', () => {
    const normalized = normalizeQuestion({
      id: 'q1',
      paciente_id: 'patient-1',
      paciente_nome: 'Maria',
      specialty: 'Cardiologia',
      pergunta: 'Tenho palpitaÃ§Ãµes?',
      resposta: 'Procure avaliaÃ§Ã£o.',
      answered_by_professional_name: 'Dr. JoÃ£o',
      public_profile_id: 'pub-1',
      status: 'RESPONDIDA',
    }, {
      'pub-1': {
        id: 'pub-1',
        specialty: 'Cardiologia',
        photo_url: 'https://example.com/photo.jpg',
      },
    });

    expect(normalized.question_text).toBe('Tenho palpitaÃ§Ãµes?');
    expect(normalized.answer_text).toBe('Procure avaliaÃ§Ã£o.');
    expect(normalized.answered_by_name).toBe('Dr. JoÃ£o');
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

describe('consulta participant contract', () => {
  it('accepts both the professional user id and the legacy professional profile id', () => {
    const consulta = {
      paciente_id: 'patient-1',
      profissional_id: 'professional-profile-1',
      profissional_user_id: 'professional-user-1',
    };

    expect(getConsultaParticipantIds(consulta)).toEqual([
      'patient-1',
      'professional-profile-1',
      'professional-user-1',
    ]);

    expect(isConsultaParticipant(consulta, 'patient-1')).toBe(true);
    expect(isConsultaParticipant(consulta, 'professional-profile-1')).toBe(true);
    expect(isConsultaParticipant(consulta, 'professional-user-1')).toBe(true);
    expect(isConsultaParticipant(consulta, ['someone-else', 'professional-user-1'])).toBe(true);
    expect(isConsultaParticipant(consulta, 'intruder')).toBe(false);
  });
});

describe('consulta schema compatibility', () => {
  it('removes profissional_user_id when the remote schema is still legacy', () => {
    expect(sanitizeConsultaPayloadForSchema({
      paciente_id: 'patient-1',
      profissional_id: 'professional-profile-1',
      profissional_user_id: 'professional-user-1',
    }, {
      profissionalUserIdSupported: false,
    })).toEqual({
      paciente_id: 'patient-1',
      profissional_id: 'professional-profile-1',
    });
  });
});

describe('zoom session contract', () => {
  it('builds deterministic room metadata from the consultation id', () => {
    expect(buildConsultaRoomPayload('123e4567-e89b-12d3-a456-426614174000')).toEqual({
      sala_id: 'consulta-123e4567-e89b-12d3-a456-426614174000',
      token_sala: '123e4567e89b12d3a456426614174000',
    });
  });

  it('reuses persisted room metadata when already present', () => {
    const consulta = {
      id: 'consulta-1',
      sala_id: 'teleconsulta-segura-1',
      token_sala: 'abc123',
    };

    expect(buildZoomSessionName(consulta)).toBe('teleconsulta-segura-1');
    expect(buildZoomSessionKey(consulta)).toBe('abc123');
  });

  it('creates scoped Zoom identities per participant role', () => {
    expect(buildZoomUserIdentity({
      userId: '123e4567-e89b-12d3-a456-426614174000',
      participantRole: 'patient',
    })).toBe('pt-123e4567e89b12d3a456426614174000');

    expect(buildZoomUserIdentity({
      userId: '123e4567-e89b-12d3-a456-426614174000',
      participantRole: 'professional',
    })).toBe('pr-123e4567e89b12d3a456426614174000');

    expect(getZoomSdkRole('patient')).toBe(0);
    expect(getZoomSdkRole('professional')).toBe(1);
  });

  it('keeps a human-readable display name for the Zoom room', () => {
    const displayName = buildZoomDisplayName({
      user: { full_name: 'Dra. Maria Silva' },
      participantRole: 'professional',
      consulta: { profissional_nome: 'Dra. Maria Silva' },
    });

    expect(displayName).toBe('Dra. Maria Silva');
  });
});
