import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { classifyApiError } from '@/lib/api-errors';
import { logApiError, serializeError } from '@/lib/observability';

function resolveQueryLogLevel(error, query) {
  if (query?.meta?.handledError) {
    return query.meta.severity || 'warn';
  }

  return classifyApiError(error).severity;
}

function shouldRetryQuery(failureCount, error) {
  return failureCount < 1 && classifyApiError(error).category === 'transient';
}

function retryDelay(attemptIndex) {
  return Math.min(1000 * (2 ** attemptIndex), 4000);
}

export const queryClientInstance = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const classification = classifyApiError(error);
      const level = resolveQueryLogLevel(error, query);

      logApiError({
        scope: 'react-query.query',
        queryKey: query.queryKey,
        classification,
        handled: Boolean(query?.meta?.handledError),
        severity: query?.meta?.severity || classification.severity,
        error: serializeError(error),
      }, { level });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const classification = classifyApiError(error);

      logApiError({
        scope: 'react-query.mutation',
        mutationKey: mutation.options.mutationKey || null,
        classification: {
          ...classification,
          category: classification.category === 'transient' ? 'fatal' : classification.category,
        },
        error: serializeError(error),
      }, { level: 'error' });
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: shouldRetryQuery,
      retryDelay,
      staleTime: 30 * 1000,
    },
    mutations: {
      retry: 0,
    },
  },
});
