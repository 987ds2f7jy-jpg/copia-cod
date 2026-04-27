import React from 'react';
import { isLogoutRedirectInProgress, useAuth } from '@/components/AuthContext';
import { useNavigate } from 'react-router-dom';
import AppLoadingScreen from '@/components/AppLoadingScreen';

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, loading, isAuthenticated, redirectToLogin } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <AppLoadingScreen message="Validando acesso..." />;
  }

  if (!isAuthenticated) {
    if (isLogoutRedirectInProgress()) {
      return null;
    }

    redirectToLogin(window.location.pathname + window.location.search);
    return null;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Acesso Restrito</h2>
        <p className="text-gray-600 mb-4">Você não tem permissão para acessar esta página.</p>
        <button onClick={() => navigate('/')} className="text-emerald-600 underline">
          Voltar ao início
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
