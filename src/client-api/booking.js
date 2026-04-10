import { invokeEdgeFunction } from './edgeFunctions';

export async function getBookingDataRequest({ professionalId }) {
  return invokeEdgeFunction('get-booking-data', {
    body: { professionalId },
    fallbackMessage: 'Nao foi possivel carregar os dados de agendamento.',
  });
}

export default {
  getBookingDataRequest,
};
