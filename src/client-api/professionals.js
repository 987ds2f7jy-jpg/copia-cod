import { invokeEdgeFunction } from './edgeFunctions';

export async function registerProfessionalRequest(payload) {
  return invokeEdgeFunction('register-professional', {
    body: payload,
    fallbackMessage: 'Nao foi possivel concluir o cadastro profissional.',
  });
}
