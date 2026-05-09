import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  canUsePaymentSimulation,
  ensurePaymentChargeRequest,
  formatMoney,
  formatPaymentProviderName,
  getPaymentStatusInfo,
  normalizePayment,
  simulatePaymentPaidRequest,
} from '@/client-api/payments';
import { toast } from '@/components/ui/use-toast';

const STATUS_BADGE_CLASSES = {
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  gray: 'bg-muted text-foreground',
};

const PAYMENT_RETURN_CONTEXT_KEY = 'rd.payment.return_context.v1';

function getCurrentPath() {
  if (typeof window === 'undefined') {
    return '';
  }

  return `${window.location.pathname}${window.location.search || ''}`;
}

function storePaymentReturnContext({
  payment,
  ownerType,
  ownerId,
  successRedirectPath,
  failureRedirectPath,
  pendingRedirectPath,
}) {
  if (typeof window === 'undefined') {
    return;
  }

  const context = {
    ownerType,
    ownerId,
    paymentChargeId: payment?.paymentChargeId || null,
    providerChargeId: payment?.providerChargeId || null,
    successRedirectPath: successRedirectPath || '',
    failureRedirectPath: failureRedirectPath || '',
    pendingRedirectPath: pendingRedirectPath || '',
    returnPath: getCurrentPath(),
    createdAt: new Date().toISOString(),
  };

  sessionStorage.setItem(PAYMENT_RETURN_CONTEXT_KEY, JSON.stringify(context));
}

export default function PaymentStep({
  payment,
  ownerType,
  ownerId,
  title = 'Pagamento necessario',
  description = 'Finalize o pagamento para liberar a proxima etapa.',
  paidTitle = 'Pagamento confirmado',
  paidDescription = 'Agora o fluxo pode continuar com seguranca.',
  continueLabel = 'Continuar',
  onPaid,
  onContinue,
  onBeforeCheckout,
  successRedirectPath = '',
  failureRedirectPath = '',
  pendingRedirectPath = '',
  className = '',
}) {
  const [localPayment, setLocalPayment] = useState(() => normalizePayment(payment));
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [syncError, setSyncError] = useState('');
  const autoSyncKeyRef = useRef('');
  const currentPayment = useMemo(
    () => normalizePayment(localPayment || payment),
    [localPayment, payment],
  );
  const statusInfo = getPaymentStatusInfo(currentPayment?.status);
  const isPaid = currentPayment?.status === 'paid';
  const isMockProvider = String(currentPayment?.provider || '').toLowerCase() === 'mock';
  const canSimulate = !isPaid && isMockProvider && canUsePaymentSimulation();
  const shouldRefreshCheckout = Boolean(
    ownerType &&
    ownerId &&
    !isPaid &&
    !isMockProvider &&
    !canSimulate &&
    (
      !currentPayment?.checkoutUrl ||
      currentPayment?.status === 'payment_failed' ||
      currentPayment?.status === 'payment_expired'
    ),
  );
  const providerLabel = formatPaymentProviderName(currentPayment?.provider);
  const checkoutButtonLabel = currentPayment?.status === 'payment_failed' || currentPayment?.status === 'payment_expired'
    ? 'Gerar novo checkout'
    : 'Abrir checkout seguro';

  useEffect(() => {
    if (!shouldRefreshCheckout || checkoutLoading || syncError) {
      return;
    }

    const syncKey = [
      ownerType,
      ownerId,
      currentPayment?.paymentChargeId || '',
      currentPayment?.status || '',
      currentPayment?.checkoutUrl || '',
    ].join(':');

    if (autoSyncKeyRef.current === syncKey) {
      return;
    }

    autoSyncKeyRef.current = syncKey;

    let active = true;

    const syncCheckout = async () => {
      setCheckoutLoading(true);
      setSyncError('');

      try {
        const nextPayment = await ensurePaymentChargeRequest({ ownerType, ownerId });

        if (!active || !nextPayment) {
          return;
        }

        setLocalPayment(nextPayment);

        if (nextPayment.status === 'paid') {
          onPaid?.(nextPayment, { status: 'paid', paidAt: nextPayment.paidAt || null });
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setSyncError(error instanceof Error ? error.message : 'Nao foi possivel atualizar a cobranca.');
      } finally {
        if (active) {
          setCheckoutLoading(false);
        }
      }
    };

    void syncCheckout();

    return () => {
      active = false;
    };
  }, [
    checkoutLoading,
    onPaid,
    ownerId,
    ownerType,
    syncError,
    shouldRefreshCheckout,
    currentPayment?.checkoutUrl,
    currentPayment?.paymentChargeId,
    currentPayment?.status,
  ]);

  async function handleCheckout() {
    setCheckoutLoading(true);
    setSyncError('');

    try {
      let nextPayment = currentPayment;

      if (
        ownerType &&
        ownerId &&
        (
          !currentPayment?.checkoutUrl ||
          currentPayment?.status === 'payment_failed' ||
          currentPayment?.status === 'payment_expired'
        )
      ) {
        nextPayment = await ensurePaymentChargeRequest({ ownerType, ownerId });
        setLocalPayment(nextPayment);
      }

      if (!nextPayment) {
        throw new Error('O backend nao retornou uma cobranca valida para este pagamento.');
      }

      if (nextPayment.status === 'paid') {
        onPaid?.(nextPayment, { status: 'paid', paidAt: nextPayment.paidAt || null });
        return;
      }

      if (!nextPayment.checkoutUrl) {
        throw new Error('Ainda nao foi possivel gerar um checkout valido para este pagamento.');
      }

      storePaymentReturnContext({
        payment: nextPayment,
        ownerType,
        ownerId,
        successRedirectPath,
        failureRedirectPath,
        pendingRedirectPath,
      });
      onBeforeCheckout?.(nextPayment);
      window.location.assign(nextPayment.checkoutUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel abrir o checkout.';
      setSyncError(message);
      toast({
        title: 'Erro ao abrir pagamento',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleSimulatePayment() {
    setSimulationLoading(true);

    try {
      const result = await simulatePaymentPaidRequest({
        paymentChargeId: currentPayment?.paymentChargeId,
        ownerType,
        ownerId,
      });
      const nextPayment = normalizePayment({
        ...currentPayment,
        status: result?.status || 'paid',
        paidAt: result?.paidAt,
      });
      setLocalPayment(nextPayment);
      onPaid?.(nextPayment, result);
      toast({
        title: 'Pagamento simulado',
        description: 'O backend marcou esta cobranca como paga para teste.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao simular pagamento',
        description: error instanceof Error ? error.message : 'Nao foi possivel simular o pagamento.',
        variant: 'destructive',
      });
    } finally {
      setSimulationLoading(false);
    }
  }

  if (!currentPayment) {
    return (
      <Card className={`border-red-100 bg-red-50 shadow-sm dark:border-red-900/60 dark:bg-red-950/40 ${className}`}>
        <CardContent className="p-5">
          <div className="flex items-start gap-3 text-red-700 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Pagamento indisponivel</p>
              <p className="text-sm">O backend nao retornou uma cobranca valida para este fluxo.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-border shadow-sm ${className}`}>
      <CardContent className="p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              isPaid
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
            }`}>
              {isPaid ? <CheckCircle className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">{isPaid ? paidTitle : title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{isPaid ? paidDescription : description}</p>
            </div>
          </div>
          <Badge className={STATUS_BADGE_CLASSES[statusInfo.tone] || STATUS_BADGE_CLASSES.amber}>
            {statusInfo.label}
          </Badge>
        </div>

        <div className="mb-4 rounded-xl bg-muted/40 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Valor oficial</span>
            <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
              {formatMoney(currentPayment.amount, currentPayment.currency)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium text-foreground">{statusInfo.description}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-muted-foreground">Checkout</span>
            <span className="font-medium text-foreground">{providerLabel}</span>
          </div>
        </div>

        {!isPaid && (
          <div className="space-y-3">
            <Button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="h-12 w-full bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {checkoutLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {checkoutButtonLabel}
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>

            {syncError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {syncError}
              </div>
            )}

            {!currentPayment.checkoutUrl && !checkoutLoading && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                Estamos preparando a cobranca segura no backend. Se necessario, uma nova tentativa sera gerada automaticamente.
              </div>
            )}

            {canSimulate && (
              <Button
                type="button"
                variant="outline"
                onClick={handleSimulatePayment}
                disabled={simulationLoading || checkoutLoading}
                className="h-12 w-full border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/40"
              >
                {simulationLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simular pagamento aprovado
              </Button>
            )}

            {!canSimulate && !checkoutLoading && !currentPayment.checkoutUrl && !syncError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                Se a cobranca anterior tiver expirado ou falhado, o backend gera um checkout novo quando voce prosseguir.
              </div>
            )}
          </div>
        )}

        {isPaid && onContinue && (
          <Button onClick={onContinue} className="h-12 w-full bg-emerald-600 text-white hover:bg-emerald-700">
            {continueLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
