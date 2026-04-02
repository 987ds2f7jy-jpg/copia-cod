import React from 'react';
import { useAuth } from '@/components/AuthContext';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    sessionStorage.setItem('rd_login_next', window.location.pathname + window.location.search);
    window.location.href = createPageUrl('Entrar');
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
