import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthContext';
import { getStoredSession } from '@/client-api/session';
import { ensureFreshSession } from '@/client-api/edgeFunctions';
import { isTransientApiError } from '@/lib/api-errors';
import {
  buildEmptyActiveConsultation,
  getMyActiveConsultationRequest,
} from '@/client-api/teleconsulta';

function isTransientAuthError(error) {
  const status = Number(error?.status ?? 0);
  const code = String(error?.code ?? '').trim().toUpperCase();
  const message = String(error?.message ?? '').trim().toLowerCase();

  if (status !== 401) {
    return false;
  }

  return (
    code === 'AUTH_REQUIRED' ||
    code === 'AUTH_SESSION_REQUIRED' ||
    code === 'AUTH_TOKEN_INVALID' ||
    code === 'AUTH_USER_INVALID' ||
    message.includes('invalid jwt') ||
    message.includes('authenticated user is required') ||
    message.includes('sessao autenticada obrigatoria')
  );
}

function isRecoverableBackgroundError(error) {
  return isTransientAuthError(error) || isTransientApiError(error);
}

export function useMyActiveConsultation({
  enabled = true,
  staleTime = 10_000,
  refetchInterval = 15_000,
} = {}) {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const hasStoredSession = Boolean(getStoredSession()?.accessToken);
  const canFetch = enabled && !loading && Boolean(user?.id) && hasStoredSession;
  const queryKey = ['myActiveConsultation', user?.id];

  return useQuery({
    queryKey,
    enabled: canFetch,
    staleTime,
    refetchInterval: canFetch ? refetchInterval : false,
    placeholderData: buildEmptyActiveConsultation,
    queryFn: async () => {
      try {
        await ensureFreshSession();
        return await getMyActiveConsultationRequest();
      } catch (error) {
        if (isRecoverableBackgroundError(error)) {
          return queryClient.getQueryData(queryKey) || buildEmptyActiveConsultation();
        }

        throw error;
      }
    },
  });
}

export default useMyActiveConsultation;
