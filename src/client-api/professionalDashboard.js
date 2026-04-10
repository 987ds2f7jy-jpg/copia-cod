import { invokeEdgeFunction } from './edgeFunctions';

export async function getProfessionalDashboardRequest({
  appointmentsLimit = 200,
  includeQueue = true,
  includeQuestions = true,
  includeReviews = true,
} = {}) {
  return invokeEdgeFunction('get-professional-dashboard', {
    body: { appointmentsLimit, includeQueue, includeQuestions, includeReviews },
    fallbackMessage: 'Nao foi possivel carregar o dashboard do profissional.',
  });
}

export async function upsertProfessionalProfileRequest(payload) {
  return invokeEdgeFunction('upsert-professional-profile', {
    body: payload || {},
    fallbackMessage: 'Nao foi possivel salvar o perfil profissional.',
  });
}

export async function replaceAvailabilitySlotsRequest({ slots }) {
  return invokeEdgeFunction('replace-availability-slots', {
    body: { slots: Array.isArray(slots) ? slots : [] },
    fallbackMessage: 'Nao foi possivel salvar a disponibilidade.',
  });
}

export async function setProfessionalDutyRequest({ isOnDuty }) {
  return invokeEdgeFunction('set-professional-duty', {
    body: { isOnDuty: Boolean(isOnDuty) },
    fallbackMessage: 'Nao foi possivel atualizar o status de plantao.',
  });
}

export async function upsertOfficeLocationRequest({
  professionalPublicProfileId,
  action = 'upsert',
  location = null,
}) {
  return invokeEdgeFunction('upsert-office-location', {
    body: { professionalPublicProfileId, action, location },
    fallbackMessage: 'Nao foi possivel salvar o endereco do consultorio.',
  });
}

export async function getOfficeLocationRequest({ professionalPublicProfileId }) {
  return invokeEdgeFunction('upsert-office-location', {
    body: { professionalPublicProfileId, action: 'get' },
    fallbackMessage: 'Nao foi possivel carregar o endereco do consultorio.',
  });
}

export async function deleteOfficeLocationRequest({ professionalPublicProfileId }) {
  return invokeEdgeFunction('upsert-office-location', {
    body: { professionalPublicProfileId, action: 'delete' },
    fallbackMessage: 'Nao foi possivel remover o endereco do consultorio.',
  });
}

export async function getAdminApprovalQueueRequest({ status = 'pending_review', limit = 100 } = {}) {
  return invokeEdgeFunction('get-admin-approval-queue', {
    body: { status, limit },
    fallbackMessage: 'Nao foi possivel carregar a fila de aprovacao.',
  });
}

export async function reviewProfessionalApplicationRequest({ publicProfileId, action }) {
  return invokeEdgeFunction('review-professional-application', {
    body: { publicProfileId, action },
    fallbackMessage: 'Nao foi possivel atualizar o status do profissional.',
  });
}

