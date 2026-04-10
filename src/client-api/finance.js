import { invokeEdgeFunction } from './edgeFunctions';

export async function getFinanceDashboardRequest({
  appointmentsLimit = 500,
  saquesLimit = 50,
} = {}) {
  return invokeEdgeFunction('get-finance-dashboard', {
    body: { appointmentsLimit, saquesLimit },
    fallbackMessage: 'Nao foi possivel carregar o dashboard financeiro.',
  });
}

export async function upsertProfessionalBankingDataRequest(payload) {
  return invokeEdgeFunction('upsert-professional-banking-data', {
    body: payload || {},
    fallbackMessage: 'Nao foi possivel salvar os dados bancarios.',
  });
}

export async function requestWithdrawalRequest({ value, pixKey = null }) {
  return invokeEdgeFunction('request-withdrawal', {
    body: { value, pixKey },
    fallbackMessage: 'Nao foi possivel solicitar o saque.',
  });
}

