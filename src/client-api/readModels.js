import { invokeEdgeFunction } from './edgeFunctions';

const ENTITY_NAMES = [
  'Appointment',
  'AvailabilitySlot',
  'Consulta',
  'ProfessionalProfile',
  'ProfessionalPublicProfile',
  'Question',
  'Queue',
  'Review',
  'SolicitacaoExame',
];

async function readEntity({
  action = 'filter',
  entity,
  filters = {},
  orderBy = '',
  limit = null,
}) {
  const result = await invokeEdgeFunction('read-models', {
    body: {
      action,
      entity,
      filters,
      orderBy,
      limit,
    },
    fallbackMessage: 'Nao foi possivel carregar os dados.',
    authMode: 'optional',
  });

  if (action === 'get') {
    return result?.record ?? null;
  }

  return Array.isArray(result?.records) ? result.records : [];
}

function createEntityReader(entity) {
  return {
    filter(filters = {}, orderBy, limit) {
      return readEntity({
        action: 'filter',
        entity,
        filters,
        orderBy,
        limit,
      });
    },
    list(orderBy, limit) {
      return readEntity({
        action: 'list',
        entity,
        filters: {},
        orderBy,
        limit,
      });
    },
    get(id) {
      return readEntity({
        action: 'get',
        entity,
        filters: { id },
        limit: 1,
      });
    },
    subscribe() {
      return () => {};
    },
  };
}

export const entities = ENTITY_NAMES.reduce((acc, entity) => ({
  ...acc,
  [entity]: createEntityReader(entity),
}), {});

export default {
  entities,
};
