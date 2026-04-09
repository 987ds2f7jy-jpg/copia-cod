import { invokeEdgeFunction } from './edgeFunctions';

export async function bootstrapAppUserRequest(payload = {}) {
  return invokeEdgeFunction('bootstrap-app-user', {
    body: payload,
    fallbackMessage: 'Nao foi possivel inicializar a conta do usuario.',
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
    body: {},
    fallbackMessage: 'Nao foi possivel desativar a conta.',
  });
}

export default {
  bootstrapAppUserRequest,
  updateMyProfileRequest,
  deactivateAccountRequest,
};
