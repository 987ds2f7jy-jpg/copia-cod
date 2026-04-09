import { invokeEdgeFunction } from './edgeFunctions';

export async function createSolicitacaoExameRequest(payload) {
  const result = await invokeEdgeFunction('create-solicitacao-exame', {
    body: payload,
    fallbackMessage: 'Nao foi possivel criar a solicitacao de exame.',
  });

  return result?.solicitacaoExame ?? null;
}

export async function updateSolicitacaoExameRequest(payload) {
  const result = await invokeEdgeFunction('update-solicitacao-exame', {
    body: payload,
    fallbackMessage: 'Nao foi possivel atualizar a solicitacao de exame.',
  });

  return result?.solicitacaoExame ?? null;
}

export async function deleteSolicitacaoExameRequest({ solicitacaoId }) {
  return invokeEdgeFunction('delete-solicitacao-exame', {
    body: {
      solicitacaoId,
    },
    fallbackMessage: 'Nao foi possivel remover a solicitacao de exame.',
  });
}
