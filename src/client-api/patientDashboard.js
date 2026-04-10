import { invokeEdgeFunction } from './edgeFunctions';

export async function getPatientDashboardRequest({
  appointmentsLimit = 300,
  reviewsLimit = 200,
} = {}) {
  return invokeEdgeFunction('get-patient-dashboard', {
    body: {
      appointmentsLimit,
      reviewsLimit,
    },
    fallbackMessage: 'Nao foi possivel carregar o dashboard do paciente.',
  });
}

export default {
  getPatientDashboardRequest,
};
