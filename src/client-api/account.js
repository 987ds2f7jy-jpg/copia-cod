import { invokeEdgeFunction } from './edgeFunctions';

export async function bootstrapAppUserRequest(payload = {}) {
  const isSignup = Boolean(payload?.email && payload?.password);

  return invokeEdgeFunction('bootstrap-app-user', {
    body: payload,
    fallbackMessage: 'Nao foi possivel inicializar a conta do usuario.',
    authMode: isSignup ? 'anon' : 'session',
  });
}

export async function loginAppUserRequest(payload) {
  return invokeEdgeFunction('login-app-user', {
    body: payload,
    fallbackMessage: 'Nao foi possivel realizar o login.',
    authMode: 'anon',
    retryOnUnauthorized: false,
  });
}

export async function updateMyProfileRequest(payload) {
  return invokeEdgeFunction('update-my-profile', {
    body: payload,
    fallbackMessage: 'Nao foi possivel atualizar o perfil.',
  });
}

export async function deactivateAccountRequest() {
  return invokeEdgeFunction('deactivate-account', {
    body: { confirmation: 'DEACTIVATE_MY_ACCOUNT' },
    fallbackMessage: 'Nao foi possivel desativar a conta.',
  });
}

export async function createPrivacyRightsRequest(payload) {
  return invokeEdgeFunction('create-privacy-rights-request', {
    body: payload,
    fallbackMessage: 'Nao foi possivel registrar a solicitacao de privacidade.',
  });
}

export async function getMyPrivacyRightsRequests({ page = 1, pageSize = 20 } = {}) {
  return invokeEdgeFunction('get-my-privacy-rights-requests', {
    body: { page, pageSize },
    fallbackMessage: 'Nao foi possivel consultar suas solicitacoes.',
  });
}

export async function generateMyPrivacyDataExport(requestId) {
  return invokeEdgeFunction('generate-my-privacy-data-export', {
    body: { requestId },
    fallbackMessage: 'Nao foi possivel gerar a exportacao agora.',
  });
}

export default {
  bootstrapAppUserRequest,
  loginAppUserRequest,
  updateMyProfileRequest,
  deactivateAccountRequest,
  createPrivacyRightsRequest,
  getMyPrivacyRightsRequests,
  generateMyPrivacyDataExport,
};
