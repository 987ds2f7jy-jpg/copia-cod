import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { logApiError, serializeError } from '@/lib/observability';

export const queryClientInstance = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      logApiError({
        scope: 'react-query.query',
        queryKey: query.queryKey,
        error: serializeError(error),
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      logApiError({
        scope: 'react-query.mutation',
        mutationKey: mutation.options.mutationKey || null,
        error: serializeError(error),
      });
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30 * 1000,
    },
    mutations: {
      retry: 0,
    },
  },
});
