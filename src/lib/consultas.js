import { base44 } from '@/api/base44Client';
import { hasColumnMissingError } from '@/lib/errors';

let consultaProfessionalUserIdSupported = true;

export function mapAppointmentTypeToConsultaType(type) {
  if (type === 'priority' || type === 'prioritario') return 'prioritario';
  if (type === 'instant' || type === 'plantao' || type === 'IMEDIATO') return 'plantao';
  if (type === 'ESPECIALIDADE' || type === 'especialidade') return 'especialidade';
  return 'padrao';
}

export function sanitizeConsultaPayloadForSchema(payload, options = {}) {
  const { profissionalUserIdSupported = true } = options;
  const nextPayload = { ...(payload || {}) };

  if (!profissionalUserIdSupported) {
    delete nextPayload.profissional_user_id;
  }

  return nextPayload;
}

export function buildConsultaFromAppointment(appointment, professional, overrides = {}) {
  const nowIso = new Date().toISOString();

  return {
    paciente_id: appointment.patient_id,
    paciente_nome: appointment.patient_name,
    paciente_email: appointment.patient_email || '',
    profissional_id: professional.id,
    profissional_user_id: professional.user_id || professional.id,
    profissional_nome: professional.full_name,
    especialidade: appointment.specialty,
    tipo_consulta: mapAppointmentTypeToConsultaType(appointment.appointment_type || appointment.tipo_consulta),
    status: 'aguardando',
    datetime: appointment.scheduled_datetime || appointment.datetime || nowIso,
    descricao_sintomas: appointment.symptoms || appointment.descricao_sintomas || '',
    preco: appointment.price || appointment.preco || professional.price_standard || 0,
    ...overrides,
  };
}

export function buildConsultaFromQueueEntry(queueEntry, professional) {
  const nowIso = new Date().toISOString();

  return {
    paciente_id: queueEntry.patient_id,
    paciente_nome: queueEntry.patient_name,
    paciente_email: queueEntry.patient_email || '',
    profissional_id: professional.id,
    profissional_user_id: professional.user_id || professional.id,
    profissional_nome: professional.full_name,
    especialidade: queueEntry.specialty,
    tipo_consulta: 'plantao',
    status: 'em_atendimento',
    datetime: nowIso,
    descricao_sintomas: queueEntry.symptoms || '',
    preco: professional.price_standard || 0,
    inicio_at: nowIso,
  };
}

export async function createConsultaRecord(payload) {
  const initialPayload = sanitizeConsultaPayloadForSchema(payload, {
    profissionalUserIdSupported: consultaProfessionalUserIdSupported,
  });

  try {
    return await base44.entities.Consulta.create(initialPayload);
  } catch (error) {
    if (
      consultaProfessionalUserIdSupported &&
      hasColumnMissingError(error, 'profissional_user_id')
    ) {
      consultaProfessionalUserIdSupported = false;

      return base44.entities.Consulta.create(
        sanitizeConsultaPayloadForSchema(payload, {
          profissionalUserIdSupported: false,
        }),
      );
    }

    throw error;
  }
}

export function getConsultaParticipantIds(consulta) {
  if (!consulta) return [];

  return [
    consulta.paciente_id,
    consulta.profissional_id,
    consulta.profissional_user_id,
  ].filter(Boolean);
}

export function isConsultaParticipant(consulta, participantIds) {
  if (!consulta || !participantIds) return false;

  const currentIds = Array.isArray(participantIds) ? participantIds : [participantIds];
  const validParticipantIds = currentIds.filter(Boolean);

  if (validParticipantIds.length === 0) {
    return false;
  }

  const consultaParticipantIds = getConsultaParticipantIds(consulta);
  return validParticipantIds.some((id) => consultaParticipantIds.includes(id));
}
