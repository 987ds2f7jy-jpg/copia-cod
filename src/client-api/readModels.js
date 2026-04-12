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

function normalizeString(value) {
  return String(value ?? '').trim();
}

function isPublicBookedAppointmentRead(filters = {}) {
  const professionalId = normalizeString(filters.professional_id);
  const status = normalizeString(filters.status).toUpperCase();

  return Boolean(
    professionalId &&
    ['CONFIRMADO', 'CONFIRMED', 'ACCEPTED', 'COMPLETED', 'CONCLUIDO'].includes(status),
  );
}

function isPublicReviewRead(filters = {}) {
  return Boolean(
    normalizeString(filters.professional_id) &&
    !normalizeString(filters.patient_id),
  );
}

function isPublicQuestionRead(filters = {}) {
  return normalizeString(filters.status).toUpperCase() === 'RESPONDIDA';
}

function isPublicQueueRead(filters = {}) {
  return (
    normalizeString(filters.status).toLowerCase() === 'waiting' &&
    Boolean(normalizeString(filters.specialty)) &&
    !normalizeString(filters.patient_id)
  );
}

function resolveReadAuthMode(entity, filters = {}) {
  if (entity === 'ProfessionalPublicProfile' || entity === 'AvailabilitySlot') {
    return 'optional';
  }

  if (entity === 'Appointment' && isPublicBookedAppointmentRead(filters)) {
    return 'optional';
  }

  if (entity === 'Review' && isPublicReviewRead(filters)) {
    return 'optional';
  }

  if (entity === 'Question' && isPublicQuestionRead(filters)) {
    return 'optional';
  }

  if (entity === 'Queue' && isPublicQueueRead(filters)) {
    return 'optional';
  }

  return 'session';
}

async function readEntity({
  action = 'filter',
  entity,
  filters = {},
  orderBy = '',
  limit = null,
}) {
  const authMode = resolveReadAuthMode(entity, filters);

  const result = await invokeEdgeFunction('read-models', {
    body: {
      action,
      entity,
      filters,
      orderBy,
      limit,
    },
    fallbackMessage: 'Nao foi possivel carregar os dados.',
    authMode,
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
