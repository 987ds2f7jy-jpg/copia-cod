import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Clock, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Bloqueia acesso ao dashboard se o profissional não estiver aprovado.
 * Statuses bloqueantes: pending_review, rejected, suspended (e o legado "pending")
 */
export default function ProfessionalStatusGate({ professional, children }) {
  const status = professional?.status;

  // Approved OR legacy "active" → allow through
  if (status === 'approved' || status === 'active') {
    return <>{children}</>;
  }

  const configs = {
    pending_review: {
      icon: Clock,
      color: 'text-amber-500',
      bg: 'bg-amber-50 border-amber-200',
      title: 'Cadastro em análise',
      body: 'Seu cadastro foi recebido e está sendo analisado pela nossa equipe. Você será notificado por e-mail após a aprovação.',
      cta: null,
    },
    pending: {
      icon: Clock,
      color: 'text-amber-500',
      bg: 'bg-amber-50 border-amber-200',
      title: 'Cadastro em análise',
      body: 'Seu cadastro está em análise. Você será notificado após a aprovação.',
      cta: null,
    },
    rejected: {
      icon: XCircle,
      color: 'text-red-500',
      bg: 'bg-red-50 border-red-200',
      title: 'Cadastro não aprovado',
      body: 'Seu cadastro não foi aprovado. Entre em contato com nosso suporte para mais informações.',
      cta: null,
    },
    suspended: {
      icon: AlertTriangle,
      color: 'text-orange-500',
      bg: 'bg-orange-50 border-orange-200',
      title: 'Conta suspensa',
      body: 'Sua conta está temporariamente suspensa. Entre em contato com o suporte para regularizar.',
      cta: null,
    },
  };

  const cfg = configs[status] || configs['pending_review'];
  const Icon = cfg.icon;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className={`max-w-md w-full rounded-2xl border p-8 text-center ${cfg.bg}`}>
        <div className={`w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto mb-4 shadow-sm`}>
          <Icon className={`w-8 h-8 ${cfg.color}`} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{cfg.title}</h2>
        <p className="text-gray-600 mb-6 text-sm leading-relaxed">{cfg.body}</p>
        <Link to={createPageUrl('Home')}>
          <Button variant="outline" className="w-full">Voltar ao Início</Button>
        </Link>
      </div>
    </div>
  );
}