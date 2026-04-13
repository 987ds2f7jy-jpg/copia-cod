import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthContext';
import { getStoredSession } from '@/client-api/session';
import { ensureFreshSession } from '@/client-api/edgeFunctions';
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

export function useMyActiveConsultation({
  enabled = true,
  staleTime = 10_000,
  refetchInterval = 15_000,
} = {}) {
  const { user, loading } = useAuth();
  const hasStoredSession = Boolean(getStoredSession()?.accessToken);
  const canFetch = enabled && !loading && Boolean(user?.id) && hasStoredSession;

  return useQuery({
    queryKey: ['myActiveConsultation', user?.id],
    enabled: canFetch,
    staleTime,
    refetchInterval: canFetch ? refetchInterval : false,
    placeholderData: buildEmptyActiveConsultation,
    queryFn: async () => {
      try {
        await ensureFreshSession();
        return await getMyActiveConsultationRequest();
      } catch (error) {
        if (isTransientAuthError(error)) {
          return buildEmptyActiveConsultation();
        }

        throw error;
      }
    },
  });
}

export default useMyActiveConsultation;
