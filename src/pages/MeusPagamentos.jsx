import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Calendar,
  Clock,
  CreditCard,
  ExternalLink,
  Inbox,
  Loader2,
  ReceiptText,
  Stethoscope,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/AuthContext';
import { getPatientPaymentsRequest } from '@/client-api/patientPayments';
import {
  formatMoney,
  formatPaymentProviderName,
  getPaymentStatusInfo,
} from '@/client-api/payments';

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'paid', label: 'Pagos' },
  { id: 'pending', label: 'Pendentes' },
  { id: 'failed', label: 'Falharam' },
  { id: 'refunded', label: 'Reembolsados' },
];

const STATUS_BADGE = {
  payment_pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  payment_processing: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  payment_failed: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  payment_expired: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  refunded: 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300',
  chargeback: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300',
};

function isSafeHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function formatarDataHora(value) {
  if (!value) {
    return { data: 'Data indisponível', hora: '' };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { data: value, hora: '' };
  }

  return {
    data: parsed.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
    hora: parsed.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

function resolveEventDate(payment) {
  return (
    payment.paid_at ||
    payment.failed_at ||
    payment.expired_at ||
    payment.refunded_at ||
    payment.chargeback_at ||
    payment.updated_at ||
    payment.created_at
  );
}

function paymentMatchesFilter(payment, filter) {
  if (filter === 'todos') return true;
  if (filter === 'pending') {
    return payment.status === 'payment_pending' || payment.status === 'payment_processing';
  }
  if (filter === 'failed') {
    return payment.status === 'payment_failed' || payment.status === 'payment_expired' || payment.status === 'chargeback';
  }
  if (filter === 'refunded') {
    return payment.status === 'refunded';
  }
  return payment.status === filter;
}

function StatusBadge({ status }) {
  const info = getPaymentStatusInfo(status);
  const cls = STATUS_BADGE[status] || 'bg-muted text-muted-foreground';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {info.label}
    </span>
  );
}

function DetailRow({ label, value }) {
  if (!value && value !== 0) {
    return null;
  }

  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground break-all">{value}</span>
    </div>
  );
}

function PaymentCard({ payment, onOpen }) {
  const dateTime = formatarDataHora(resolveEventDate(payment));
  const provider = formatPaymentProviderName(payment.provider);

  return (
    <Card className="border-border hover:shadow-md transition-shadow">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={payment.status} />
              {payment.is_current && (
                <Badge variant="outline" className="text-xs">Atual</Badge>
              )}
              <Badge variant="outline" className="text-xs">{payment.service_type}</Badge>
            </div>

            <div>
              <h3 className="text-base font-semibold text-foreground">{payment.service_type}</h3>
              <div className="mt-2 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium text-foreground">{dateTime.data}</span>
                  {dateTime.hora && (
                    <>
                      <Clock className="ml-2 h-4 w-4" />
                      <span>{dateTime.hora}</span>
                    </>
                  )}
                </div>
                {payment.professional_name && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Stethoscope className="h-4 w-4" />
                    <span>{payment.professional_name}</span>
                  </div>
                )}
                {payment.specialty && (
                  <div className="text-sm text-muted-foreground">
                    {payment.specialty}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CreditCard className="h-4 w-4" />
                  <span>{provider}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <div className="text-left sm:text-right">
              <p className="text-xs text-muted-foreground">Valor</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                {formatMoney(payment.amount, payment.currency)}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => onOpen(payment)}
              className="w-full sm:w-auto"
            >
              <ReceiptText className="h-4 w-4" />
              Ver detalhes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentDetailsModal({ payment, open, onClose }) {
  if (!payment) return null;

  const created = formatarDataHora(payment.created_at);
  const paid = formatarDataHora(payment.paid_at);
  const failed = formatarDataHora(payment.failed_at || payment.expired_at || payment.refunded_at || payment.chargeback_at);
  const canResumeCheckout = (
    (payment.status === 'payment_pending' || payment.status === 'payment_processing') &&
    isSafeHttpUrl(payment.checkout_url)
  );

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-emerald-600" />
            Detalhes do pagamento
          </DialogTitle>
          <DialogDescription>
            {payment.service_type} • {formatMoney(payment.amount, payment.currency)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={payment.status} />
            {payment.is_current && <Badge variant="outline">Tentativa atual</Badge>}
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <DetailRow label="ID" value={payment.id ? `...${payment.id.slice(-8)}` : ''} />
            <DetailRow label="Tentativa" value={payment.attempt_number} />
            <DetailRow label="Provedor" value={formatPaymentProviderName(payment.provider)} />
            <DetailRow label="Referência" value={payment.external_reference} />
            <DetailRow label="Criado em" value={`${created.data}${created.hora ? ` às ${created.hora}` : ''}`} />
            {payment.paid_at && (
              <DetailRow label="Pago em" value={`${paid.data}${paid.hora ? ` às ${paid.hora}` : ''}`} />
            )}
            {(payment.failed_at || payment.expired_at || payment.refunded_at || payment.chargeback_at) && (
              <DetailRow label="Atualizado em" value={`${failed.data}${failed.hora ? ` às ${failed.hora}` : ''}`} />
            )}
            <DetailRow label="Especialidade" value={payment.specialty} />
            <DetailRow label="Profissional" value={payment.professional_name} />
            <DetailRow label="Status operacional" value={payment.operational_status} />
            <DetailRow label="Motivo" value={payment.failure_reason} />
          </div>

          {canResumeCheckout && (
            <a
              href={payment.checkout_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Abrir checkout
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
          <Inbox className="h-7 w-7 text-emerald-600" />
        </div>
        <h3 className="text-base font-semibold text-foreground">Nenhum pagamento encontrado.</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Quando você iniciar uma consulta ou serviço pago, as tentativas aparecerão aqui.
        </p>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <Card className="border-border">
      <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <Loader2 className="mb-4 h-7 w-7 animate-spin text-emerald-600" />
        <h3 className="text-base font-semibold text-foreground">Carregando pagamentos...</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Buscando seu histórico com segurança.
        </p>
      </CardContent>
    </Card>
  );
}

function ErrorState({ message }) {
  return (
    <Card className="border-red-200 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/10">
      <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <AlertCircle className="mb-4 h-7 w-7 text-red-600 dark:text-red-300" />
        <h3 className="text-base font-semibold text-red-900 dark:text-red-100">
          Não foi possível carregar seus pagamentos.
        </h3>
        <p className="mt-1 max-w-sm text-sm text-red-700 dark:text-red-200">
          {message || 'Tente novamente em instantes.'}
        </p>
      </CardContent>
    </Card>
  );
}

function AccessDeniedState() {
  return (
    <Card className="border-border">
      <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <CreditCard className="mb-4 h-8 w-8 text-muted-foreground" />
        <h3 className="text-base font-semibold text-foreground">Área exclusiva do paciente.</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Entre com uma conta de paciente para acessar seus pagamentos.
        </p>
      </CardContent>
    </Card>
  );
}

export default function MeusPagamentos() {
  const [filtro, setFiltro] = useState('todos');
  const [selected, setSelected] = useState(null);
  const { user, loading: authLoading } = useAuth();
  const canLoadPayments = Boolean(user?.role === 'patient');

  const paymentsQuery = useQuery({
    queryKey: ['patient-payments'],
    queryFn: () => getPatientPaymentsRequest({ limit: 150 }),
    enabled: canLoadPayments,
    staleTime: 60_000,
    meta: { handledError: true, severity: 'warn' },
  });

  const items = paymentsQuery.data?.items || [];
  const summary = paymentsQuery.data?.summary || {};

  const filteredItems = useMemo(() => (
    items.filter((item) => paymentMatchesFilter(item, filtro))
  ), [filtro, items]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Meus Pagamentos</h1>
          <p className="mt-2 text-sm text-muted-foreground lg:text-base">
            Acompanhe pagamentos feitos, pendentes ou tentados dentro da plataforma.
          </p>
        </header>

        {authLoading ? (
          <LoadingState />
        ) : !canLoadPayments ? (
          <AccessDeniedState />
        ) : paymentsQuery.isLoading ? (
          <LoadingState />
        ) : paymentsQuery.isError ? (
          <ErrorState message={paymentsQuery.error?.message} />
        ) : (
          <>
            <div className="mb-6 grid gap-3 sm:grid-cols-3">
              <Card className="border-border">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Pagos</p>
                  <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">
                    {formatMoney(summary.total_paid || 0)}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                  <p className="mt-1 text-lg font-bold text-amber-700 dark:text-amber-300">
                    {formatMoney(summary.total_pending || 0)}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Falhas/expirados</p>
                  <p className="mt-1 text-lg font-bold text-red-700 dark:text-red-300">
                    {formatMoney(summary.total_failed || 0)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
              {FILTROS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setFiltro(filter.id)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    filtro === filter.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {filteredItems.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-4">
                {filteredItems.map((payment) => (
                  <PaymentCard
                    key={payment.id}
                    payment={payment}
                    onOpen={setSelected}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <PaymentDetailsModal
        payment={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
