import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getPaymentStatusRequest } from '@/client-api/payments';
import { createPageUrl } from '@/utils';

const PAYMENT_RETURN_CONTEXT_KEY = 'rd.payment.return_context.v1';
const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 55000;
const TERMINAL_PAYMENT_STATUSES = new Set([
  'payment_failed',
  'payment_expired',
  'cancelled',
  'refunded',
  'chargeback',
]);

function readPaymentReturnContext() {
  if (typeof window === 'undefined') return null;

  const storedValue = window.sessionStorage.getItem(PAYMENT_RETURN_CONTEXT_KEY);
  if (!storedValue) return null;

  try {
    const parsed = JSON.parse(storedValue);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function clearPaymentReturnContext() {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(PAYMENT_RETURN_CONTEXT_KEY);
  }
}

function safeInternalPath(value, fallback) {
  const path = String(value || '').trim();
  return path.startsWith('/') && !path.startsWith('//') ? path : fallback;
}

function resolvePaymentReturnView(payment, { timedOut = false, error = '' } = {}) {
  if (error) {
    return {
      tone: 'red',
      icon: AlertTriangle,
      title: 'Nao foi possivel consultar o pagamento',
      description: error,
      complete: false,
    };
  }

  if (!payment) {
    return {
      tone: 'amber',
      icon: Clock,
      title: 'Consultando pagamento',
      description: 'Aguarde enquanto verificamos a cobranca no backend.',
      complete: false,
    };
  }

  if (payment.status === 'paid' && payment.serviceReleased) {
    return {
      tone: 'emerald',
      icon: CheckCircle,
      title: 'Pagamento confirmado',
      description: 'O pagamento foi confirmado e o servico esta liberado.',
      complete: true,
    };
  }

  if (payment.status === 'paid') {
    return {
      tone: 'blue',
      icon: Clock,
      title: 'Pagamento confirmado',
      description: timedOut
        ? 'O pagamento foi confirmado. A finalizacao continua no backend e pode ser acompanhada em Meus Pagamentos.'
        : 'Pagamento confirmado, finalizando processamento.',
      complete: false,
    };
  }

  if (payment.status === 'refunded' || payment.status === 'chargeback') {
    return {
      tone: 'red',
      icon: AlertTriangle,
      title: payment.status === 'refunded' ? 'Pagamento estornado' : 'Pagamento contestado',
      description: 'Este pagamento nao esta elegivel para liberar atendimento.',
      complete: false,
    };
  }

  if (payment.status === 'payment_failed' || payment.status === 'payment_expired' || payment.status === 'cancelled') {
    return {
      tone: 'red',
      icon: AlertTriangle,
      title: 'Pagamento nao concluido',
      description: 'O backend nao confirmou esta cobranca. Retorne ao fluxo para tentar novamente.',
      complete: false,
    };
  }

  return {
    tone: 'amber',
    icon: Clock,
    title: timedOut ? 'Confirmacao ainda pendente' : 'Pagamento em processamento',
    description: timedOut
      ? 'A confirmacao esta demorando mais que o esperado. Consulte novamente ou acompanhe em Meus Pagamentos.'
      : 'Estamos aguardando a confirmacao segura do provedor.',
    complete: false,
  };
}

function PagamentoRetornoInner() {
  const navigate = useNavigate();
  const { status: gatewayStatus = 'pendente' } = useParams();
  const context = useMemo(() => readPaymentReturnContext(), []);
  const chargeId = String(context?.paymentChargeId || '').trim();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(Boolean(chargeId));
  const [error, setError] = useState('');
  const [timedOut, setTimedOut] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const successPath = safeInternalPath(
    context?.successRedirectPath || context?.returnPath,
    createPageUrl('DashboardPaciente'),
  );
  const pendingPath = safeInternalPath(
    context?.pendingRedirectPath,
    createPageUrl('MeusPagamentos'),
  );
  const failurePath = safeInternalPath(
    context?.failureRedirectPath,
    createPageUrl('MeusPagamentos'),
  );

  const requestRefresh = useCallback(() => {
    setError('');
    setTimedOut(false);
    setLoading(true);
    setRefreshToken((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!chargeId) return undefined;

    let active = true;
    let timerId = null;
    const startedAt = Date.now();

    const poll = async () => {
      try {
        const result = await getPaymentStatusRequest({ chargeId });
        if (!active) return;

        setPayment(result);
        setLoading(false);
        setError('');

        const isComplete = result?.status === 'paid' && result?.serviceReleased;
        const isTerminal = TERMINAL_PAYMENT_STATUSES.has(String(result?.status || ''));

        if (isComplete || isTerminal) return;

        if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
          setTimedOut(true);
          return;
        }

        timerId = window.setTimeout(poll, POLL_INTERVAL_MS);
      } catch (requestError) {
        if (!active) return;
        setLoading(false);
        setError(requestError instanceof Error
          ? requestError.message
          : 'Nao foi possivel consultar o pagamento.');
      }
    };

    void poll();

    return () => {
      active = false;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [chargeId, refreshToken]);

  if (!chargeId) {
    return (
      <div className="min-h-screen bg-background py-12 text-foreground">
        <div className="mx-auto max-w-lg px-4">
          <Card className="border-border shadow-sm">
            <CardContent className="p-8 text-center">
              <AlertTriangle className="mx-auto mb-5 h-12 w-12 text-amber-600" />
              <h1 className="mb-3 text-2xl font-bold">Pagamento nao identificado</h1>
              <p className="mb-6 text-sm leading-6 text-muted-foreground">
                O retorno do gateway ({gatewayStatus}) nao comprova pagamento e nao encontramos o contexto interno da cobranca.
              </p>
              <Button onClick={() => navigate(createPageUrl('MeusPagamentos'), { replace: true })}>
                Ver Meus Pagamentos
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const view = resolvePaymentReturnView(payment, { timedOut, error });
  const Icon = view.icon;
  const toneClasses = {
    emerald: 'bg-emerald-100 text-emerald-700',
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
  };
  const canPollAgain = Boolean(error || timedOut);
  const fallbackPath = payment && TERMINAL_PAYMENT_STATUSES.has(payment.status)
    ? failurePath
    : pendingPath;

  return (
    <div className="min-h-screen bg-background py-12 text-foreground">
      <div className="mx-auto max-w-lg px-4">
        <Card className="border-border shadow-sm">
          <CardContent className="p-8 text-center">
            <div className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full ${toneClasses[view.tone]}`}>
              {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : <Icon className="h-8 w-8" />}
            </div>
            <h1 className="mb-3 text-2xl font-bold">{view.title}</h1>
            <p className="mx-auto mb-6 max-w-sm text-sm leading-6 text-muted-foreground">{view.description}</p>

            {!loading && !timedOut && !error && payment && !view.complete && !TERMINAL_PAYMENT_STATUSES.has(payment.status) && (
              <div className="mb-5 flex items-center justify-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                Atualizando status com seguranca...
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              {view.complete && (
                <Button onClick={() => { clearPaymentReturnContext(); navigate(successPath, { replace: true }); }}>
                  Continuar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
              {canPollAgain && (
                <Button variant="outline" onClick={requestRefresh}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Consultar novamente
                </Button>
              )}
              {!view.complete && (
                <Button variant="outline" onClick={() => navigate(fallbackPath, { replace: true })}>
                  Acompanhar pagamento
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PagamentoRetorno() {
  return (
    <ProtectedRoute requiredRole="patient">
      <PagamentoRetornoInner />
    </ProtectedRoute>
  );
}
