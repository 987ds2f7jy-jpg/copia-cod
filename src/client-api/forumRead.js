import { invokeEdgeFunction } from './edgeFunctions';

export async function getForumReadRequest({
  filterSpecialty = 'Todas',
  includePublic = true,
  includeMine = false,
} = {}) {
  return invokeEdgeFunction('get-forum-read', {
    body: {
      filterSpecialty,
      includePublic,
      includeMine,
    },
    fallbackMessage: 'Nao foi possivel carregar os dados do forum.',
  });
}

export default {
  getForumReadRequest,
};
