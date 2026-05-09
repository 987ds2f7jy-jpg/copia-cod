import React, { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { createPageUrl } from '@/utils';

const PAYMENT_RETURN_CONTEXT_KEY = 'rd.payment.return_context.v1';
const REDIRECT_DELAY_MS = 3000;

const STATUS_CONFIG = {
  sucesso: {
    icon: CheckCircle,
    title: 'Pagamento recebido',
    description: 'Estamos confirmando seu pagamento e você será redirecionado automaticamente para continuar.',
    className: 'text-emerald-600 bg-emerald-100',
    defaultRedirect: createPageUrl('DashboardPaciente'),
  },
  falha: {
    icon: AlertTriangle,
    title: 'Pagamento não concluído',
    description: 'Não conseguimos confirmar o pagamento. Você será redirecionado para tentar novamente.',
    className: 'text-red-600 bg-red-100',
    defaultRedirect: createPageUrl('DashboardPaciente'),
  },
  pendente: {
    icon: Clock,
    title: 'Pagamento pendente',
    description: 'O pagamento ainda está em processamento. Você será redirecionado para acompanhar o status.',
    className: 'text-amber-600 bg-amber-100',
    defaultRedirect: createPageUrl('DashboardPaciente'),
  },
};

function readPaymentReturnContext() {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedValue = sessionStorage.getItem(PAYMENT_RETURN_CONTEXT_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    return JSON.parse(storedValue);
  } catch {
    return null;
  }
}

function clearPaymentReturnContext() {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.removeItem(PAYMENT_RETURN_CONTEXT_KEY);
}

function resolveRedirectPath(status, config, context) {
  if (status === 'sucesso') {
    return context?.successRedirectPath || context?.returnPath || config.defaultRedirect;
  }

  if (status === 'falha') {
    return context?.failureRedirectPath || context?.returnPath || config.defaultRedirect;
  }

  return context?.pendingRedirectPath || context?.returnPath || config.defaultRedirect;
}

function PagamentoRetornoInner() {
  const navigate = useNavigate();
  const { status = 'pendente' } = useParams();
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pendente;
  const context = useMemo(() => readPaymentReturnContext(), []);
  const redirectPath = useMemo(
    () => resolveRedirectPath(status, config, context),
    [config, context, status],
  );
  const Icon = config.icon;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      clearPaymentReturnContext();
      navigate(redirectPath, { replace: true });
    }, REDIRECT_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [navigate, redirectPath]);

  return (
    <div className="min-h-screen bg-background py-12 text-foreground">
      <div className="mx-auto max-w-lg px-4">
        <Card className="border-border shadow-sm">
          <CardContent className="p-8 text-center">
            <div className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full ${config.className}`}>
              <Icon className="h-8 w-8" />
            </div>
            <h1 className="mb-3 text-2xl font-bold text-foreground">{config.title}</h1>
            <p className="mx-auto mb-6 max-w-sm text-sm leading-6 text-muted-foreground">{config.description}</p>
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Você está sendo redirecionado...
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PagamentoRetorno() {
  return (
    <ProtectedRoute>
      <PagamentoRetornoInner />
    </ProtectedRoute>
  );
}
