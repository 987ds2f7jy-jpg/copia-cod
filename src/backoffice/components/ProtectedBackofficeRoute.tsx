import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import AppLoadingScreen from '@/components/AppLoadingScreen';
import { useBackofficeAuth } from '../hooks/useBackofficeAuth';

export function ProtectedBackofficeRoute({ children }: { children: ReactNode }) {
  const { loading, session } = useBackofficeAuth();
  const location = useLocation();

  if (loading) return <AppLoadingScreen message="Validando sessão administrativa..." />;
  if (!session || session.expiresAt * 1000 <= Date.now()) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
