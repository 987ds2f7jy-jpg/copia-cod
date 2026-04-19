import { invokeEdgeFunction } from './edgeFunctions';

export async function quoteServicePricingRequest(payload) {
  const result = await invokeEdgeFunction('quote-service-pricing', {
    body: payload,
    fallbackMessage: 'Nao foi possivel carregar o valor oficial.',
  });

  return result?.pricing ?? null;
}
