import { invokeEdgeFunction } from './edgeFunctions';

export async function getHomeBannersRequest() {
  const result = await invokeEdgeFunction('read-home-banners', {
    body: {},
    fallbackMessage: 'Nao foi possivel carregar os banners da home.',
    authMode: 'anon',
    retryOnUnauthorized: false,
  });

  return Array.isArray(result?.banners) ? result.banners : [];
}
