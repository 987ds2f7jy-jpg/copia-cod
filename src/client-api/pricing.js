import { invokeEdgeFunction } from './edgeFunctions';
import { shouldRetryIdempotentApiError } from '@/lib/api-errors';

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function retryIdempotentRequest(action, {
  maxRetries = 2,
  baseDelayMs = 350,
} = {}) {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries || !shouldRetryIdempotentApiError(error)) {
        throw error;
      }

      await wait(baseDelayMs * (2 ** attempt));
    }
  }

  throw lastError;
}

export async function quoteServicePricingRequest(payload) {
  const result = await retryIdempotentRequest(() =>
    invokeEdgeFunction('quote-service-pricing', {
      body: payload,
      fallbackMessage: 'Nao foi possivel carregar o valor oficial.',
    })
  );

  return result?.pricing ?? null;
}
