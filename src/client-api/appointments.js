import { invokeEdgeFunction } from './edgeFunctions';
import { normalizePayment } from './payments';

export async function createAppointmentRequest({
  professionalProfileId = null,
  specialty = '',
  date,
  time,
  symptoms = '',
  priority = false,
  fundingSource = 'self_pay',
}) {
  const result = await invokeEdgeFunction('create-appointment', {
    body: {
      professionalProfileId,
      specialty,
      date,
      time,
      symptoms,
      priority,
      fundingSource,
    },
    fallbackMessage: 'Nao foi possivel criar o agendamento.',
  });

  return {
    ...result,
    appointment: result?.appointment
      ? {
        ...result.appointment,
        payment: normalizePayment(result?.payment, result.appointment),
      }
      : null,
    payment: normalizePayment(result?.payment, result?.appointment),
  };
}

export async function cancelAppointmentRequest({
  appointmentId,
  reason = '',
}) {
  const result = await invokeEdgeFunction('cancel-appointment', {
    body: {
      appointmentId,
      reason,
    },
    fallbackMessage: 'Nao foi possivel cancelar a consulta.',
  });

  return result?.appointment ?? null;
}

export async function acceptAppointmentRequest({ appointmentId }) {
  return invokeEdgeFunction('accept-appointment', {
    body: {
      appointmentId,
    },
    fallbackMessage: 'Nao foi possivel aceitar a solicitacao.',
  });
}

export async function submitAppointmentReviewRequest({
  appointmentId,
  rating,
  comment = '',
}) {
  return invokeEdgeFunction('submit-appointment-review', {
    body: {
      appointmentId,
      rating,
      comment,
    },
    fallbackMessage: 'Nao foi possivel enviar a avaliacao da consulta.',
  });
}
