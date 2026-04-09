import { invokeEdgeFunction } from './edgeFunctions';

export async function createAppointmentRequest({
  professionalProfileId = null,
  specialty = '',
  date,
  time,
  symptoms = '',
  priority = false,
}) {
  return invokeEdgeFunction('create-appointment', {
    body: {
      professionalProfileId,
      specialty,
      date,
      time,
      symptoms,
      priority,
    },
    fallbackMessage: 'Nao foi possivel criar o agendamento.',
  });
}
