import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  canUsePaymentSimulation,
  formatMoney,
  getPaymentStatusInfo,
  normalizePayment,
  simulatePaymentPaidRequest,
} from '@/client-api/payments';
import { toast } from '@/components/ui/use-toast';

const STATUS_BADGE_CLASSES = {
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-700',
  gray: 'bg-gray-100 text-gray-700',
};

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
  className = '',
}) {
  const [localPayment, setLocalPayment] = useState(() => normalizePayment(payment));
  const [simulationLoading, setSimulationLoading] = useState(false);
  const currentPayment = useMemo(
    () => normalizePayment(localPayment || payment),
    [localPayment, payment],
  );
  const statusInfo = getPaymentStatusInfo(currentPayment?.status);
  const isPaid = currentPayment?.status === 'paid';
  const canSimulate = !isPaid && canUsePaymentSimulation();

  function handleCheckout() {
    if (!currentPayment?.checkoutUrl) {
      return;
    }

    window.location.assign(currentPayment.checkoutUrl);
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
      <Card className={`border-red-100 bg-red-50 shadow-sm ${className}`}>
        <CardContent className="p-5">
          <div className="flex items-start gap-3 text-red-700">
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
    <Card className={`border-0 shadow-sm ${className}`}>
      <CardContent className="p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {isPaid ? <CheckCircle className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{isPaid ? paidTitle : title}</h3>
              <p className="mt-1 text-sm text-gray-600">{isPaid ? paidDescription : description}</p>
            </div>
          </div>
          <Badge className={STATUS_BADGE_CLASSES[statusInfo.tone] || STATUS_BADGE_CLASSES.amber}>
            {statusInfo.label}
          </Badge>
        </div>

        <div className="mb-4 rounded-xl bg-gray-50 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Valor oficial</span>
            <span className="text-lg font-bold text-emerald-700">
              {formatMoney(currentPayment.amount, currentPayment.currency)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-gray-500">Status</span>
            <span className="font-medium text-gray-800">{statusInfo.description}</span>
          </div>
        </div>

        {!isPaid && (
          <div className="space-y-3">
            {currentPayment.checkoutUrl && (
              <Button onClick={handleCheckout} className="h-12 w-full bg-emerald-600 text-white hover:bg-emerald-700">
                Ir para pagamento
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            )}

            {canSimulate && (
              <Button
                type="button"
                variant="outline"
                onClick={handleSimulatePayment}
                disabled={simulationLoading}
                className="h-12 w-full border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
              >
                {simulationLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simular pagamento aprovado
              </Button>
            )}

            {!currentPayment.checkoutUrl && !canSimulate && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                A cobranca foi criada, mas ainda nao ha checkout disponivel para este ambiente.
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
