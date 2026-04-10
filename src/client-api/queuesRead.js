import { invokeEdgeFunction } from './edgeFunctions';

export async function getQueuesOverviewRequest({
  specialty = '',
  queueId = '',
  patientId = '',
} = {}) {
  return invokeEdgeFunction('get-queues-read', {
    body: {
      action: 'overview',
      specialty,
      queueId,
      patientId,
    },
    fallbackMessage: 'Nao foi possivel carregar os dados da fila.',
  });
}

export async function getCurrentQueueEntryRequest({
  patientId = '',
  specialty = '',
} = {}) {
  const result = await invokeEdgeFunction('get-queues-read', {
    body: {
      action: 'current-entry',
      patientId,
      specialty,
    },
    fallbackMessage: 'Nao foi possivel consultar a fila atual.',
  });
  return result?.currentEntry || null;
}

export async function listDirectSolicitacoesForProfessionalRequest({
  professionalSpecialty = '',
} = {}) {
  const result = await invokeEdgeFunction('get-queues-read', {
    body: {
      action: 'direct-solicitacoes',
      professionalSpecialty,
    },
    fallbackMessage: 'Nao foi possivel carregar as solicitacoes pendentes.',
  });
  return result?.solicitacoes || [];
}

export async function resolveLaudoSolicitacaoFromQueueRequest({ queueEntry } = {}) {
  const result = await invokeEdgeFunction('get-queues-read', {
    body: {
      action: 'resolve-laudo',
      queueEntry,
    },
    fallbackMessage: 'Nao foi possivel carregar os dados do laudo.',
  });
  return result?.solicitacao || null;
}

export default {
  getQueuesOverviewRequest,
  getCurrentQueueEntryRequest,
  listDirectSolicitacoesForProfessionalRequest,
  resolveLaudoSolicitacaoFromQueueRequest,
};
