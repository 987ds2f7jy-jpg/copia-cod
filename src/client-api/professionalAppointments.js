import { invokeEdgeFunction } from './edgeFunctions';

export async function acceptAppointmentRequest({ appointmentId }) {
  return invokeEdgeFunction('accept-appointment', {
    body: { appointmentId },
    fallbackMessage: 'Nao foi possivel aceitar a solicitacao de agendamento.',
  });
}

export async function acceptQueueEntryRequest({ queueId }) {
  return invokeEdgeFunction('accept-queue-entry', {
    body: { queueId },
    fallbackMessage: 'Nao foi possivel aceitar o paciente da fila.',
  });
}

export default {
  acceptAppointmentRequest,
  acceptQueueEntryRequest,
};
