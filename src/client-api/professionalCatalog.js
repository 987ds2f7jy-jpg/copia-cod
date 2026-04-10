import { invokeEdgeFunction } from './edgeFunctions';

export async function getProfessionalCatalogRequest({
  specialty = '',
  searchTerm = '',
  onlyActive = true,
} = {}) {
  return invokeEdgeFunction('get-professional-catalog', {
    body: {
      specialty,
      searchTerm,
      onlyActive,
    },
    fallbackMessage: 'Nao foi possivel carregar o catalogo de profissionais.',
  });
}

export default {
  getProfessionalCatalogRequest,
};
