import { invokeEdgeFunction } from './edgeFunctions';

function normalizeQueueEntry(queueEntry) {
  if (!queueEntry) {
    return null;
  }

  const normalized = {
    ...queueEntry,
    estimatedWaitTime: queueEntry.estimatedWaitTime ?? queueEntry.estimated_wait_time ?? 0,
    assignedProfessionalId: queueEntry.assignedProfessionalId ?? queueEntry.assigned_professional_id ?? '',
    solicitacaoExameId: queueEntry.solicitacaoExameId ?? queueEntry.solicitacao_exame_id ?? '',
  };

  return {
    ...normalized,
    estimated_wait_time: normalized.estimatedWaitTime,
    assigned_professional_id: normalized.assignedProfessionalId,
    solicitacao_exame_id: normalized.solicitacaoExameId,
  };
}

export async function joinQueueEntry({
  specialty,
  symptoms = '',
  priorityLevel = 'normal',
  solicitacaoExameId = '',
}) {
  const result = await invokeEdgeFunction('join-queue', {
    body: {
      specialty,
      symptoms,
      priorityLevel,
      solicitacaoExameId,
    },
    fallbackMessage: 'Nao foi possivel entrar na fila.',
  });

  return {
    ...result,
    queueEntry: normalizeQueueEntry(result?.queueEntry),
  };
}

export async function leaveQueueEntry({ queueId = null } = {}) {
  const result = await invokeEdgeFunction('leave-queue', {
    body: {
      queueId,
    },
    fallbackMessage: 'Nao foi possivel sair da fila.',
  });

  return {
    ...result,
    queueEntry: normalizeQueueEntry(result?.queueEntry),
  };
}

export async function acceptQueueEntryRequest({ queueId }) {
  const result = await invokeEdgeFunction('accept-queue-entry', {
    body: {
      queueId,
    },
    fallbackMessage: 'Nao foi possivel aceitar o paciente da fila.',
  });

  return {
    ...result,
    queue: normalizeQueueEntry(result?.queue),
  };
}
