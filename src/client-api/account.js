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
    body: {},
    fallbackMessage: 'Nao foi possivel desativar a conta.',
  });
}

export default {
  bootstrapAppUserRequest,
  loginAppUserRequest,
  updateMyProfileRequest,
  deactivateAccountRequest,
};
