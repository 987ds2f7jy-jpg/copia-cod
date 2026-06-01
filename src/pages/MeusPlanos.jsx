import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Sparkles, CheckCircle2, XCircle, Calendar, RefreshCw, CreditCard,
  Users, UserPlus, Clock, ShieldCheck, Stethoscope, Baby, Brain,
  Apple, Dumbbell, ClipboardList, AlertCircle, ChevronRight, Inbox,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { getMyPlans } from '@/client-api/plans';
import { formatMoney } from '@/client-api/payments';

const CREDIT_ICON_BY_CODE = {
  clinico_geral: Stethoscope,
  clinico: Stethoscope,
  pediatria: Baby,
  psicologia: Brain,
  psiquiatria: Brain,
  nutricao: Apple,
  endocrinologia: Apple,
  educacao_fisica: Dumbbell,
  ginecologia: Stethoscope,
  dermatologia: Stethoscope,
  cardiologia: Stethoscope,
};

const PLAN_STATUS_LABELS = {
  active: 'Ativo',
  activating_plan: 'Pendente',
  payment_confirmed: 'Pendente',
  pending_payment: 'Pendente',
  activation_failed: 'Falha',
  canceled: 'Inativo',
  refunded: 'Inativo',
};

function formatDate(value, fallback = 'A definir') {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed.toLocaleDateString('pt-BR');
}

function statusLabel(status) {
  return PLAN_STATUS_LABELS[status] || status || 'Inativo';
}

function PlanStatusBadge({ status }) {
  const label = statusLabel(status);
  const map = {
    Ativo: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    Pendente: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    Falha: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300',
    Inativo: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${map[label] || map.Inativo}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function UsageStatusBadge({ status }) {
  const map = {
    Usado: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    Concluído: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    Pendente: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] || 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}

/* ---------- Seção 1: Card do plano atual ---------- */
function CurrentPlanCard({ plan }) {
  const rows = [
    { icon: Calendar, label: 'Contratação', value: formatDate(plan.createdAt) },
    { icon: RefreshCw, label: 'Próxima renovação', value: formatDate(plan.nextRenewalAt) },
    { icon: Clock, label: 'Dia de renovação', value: plan.renewalDayLabel || 'A definir' },
  ];
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Plano atual</p>
              <h2 className="text-xl font-bold text-foreground">{plan.name}</h2>
            </div>
          </div>
          <PlanStatusBadge status={plan.status} />
        </div>

        <p className="mt-4 text-2xl font-bold text-foreground">{formatMoney(plan.amount, plan.currency)}/mês</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {rows.map((row) => (
            <div key={row.label} className="rounded-lg border border-border bg-muted/30 p-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <row.icon className="w-3.5 h-3.5" />
                {row.label}
              </span>
              <p className="mt-1 text-sm font-semibold text-foreground">{row.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Button variant="outline" disabled>
            Ver detalhes do plano
          </Button>
          <Button variant="outline" asChild>
            <Link to={createPageUrl('Planos')}>Ver planos disponíveis</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Seção 2: Créditos / consultas disponíveis ---------- */
function CreditsSection({ credits, source }) {
  const sourceLabel = source === 'plans_service'
    ? 'Créditos atualizados pelo plano'
    : 'Créditos estimados até a próxima sincronização';

  return (
    <section>
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h3 className="text-base font-semibold text-foreground">Créditos disponíveis</h3>
        <span className="text-xs text-muted-foreground">{sourceLabel}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {credits.map((credit) => {
          const total = credit.total || credit.available + credit.used;
          const pct = total > 0 ? (credit.available / total) * 100 : 0;
          const CreditIcon = CREDIT_ICON_BY_CODE[credit.code] || Stethoscope;
          return (
            <Card key={credit.id} className={!credit.included ? 'opacity-70' : ''}>
              <CardContent className="p-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <CreditIcon className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-300" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{credit.label}</p>
                </div>

                {credit.included ? (
                  <>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-foreground">{credit.available}</span>
                      <span className="text-xs text-muted-foreground">disponível • {credit.used} usado</span>
                    </div>
                    <Progress value={pct} className="mt-3 h-1.5" />
                  </>
                ) : (
                  <p className="mt-4 text-xs text-muted-foreground">Não incluso neste plano</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- Seção 3: Cobertura ---------- */
function CoverageSection({ coverage }) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardContent className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Incluído no plano
          </h3>
          <ul className="space-y-2.5">
            {coverage.included.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Não incluso neste plano</h3>
          <ul className="space-y-2.5">
            {coverage.notIncluded.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <XCircle className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}

/* ---------- Seção 4: Histórico de uso ---------- */
function UsageHistorySection({ history }) {
  if (!history.length) {
    return (
      <section>
        <h3 className="text-base font-semibold text-foreground mb-4">Histórico de uso</h3>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center text-center py-10 px-6">
            <ClipboardList className="w-6 h-6 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">Nenhum uso registrado ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Quando houver consumo de créditos, ele aparecerá aqui.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <h3 className="text-base font-semibold text-foreground mb-4">Histórico de uso</h3>

      {/* Tabela (desktop) */}
      <Card className="hidden sm:block">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3 font-medium">Especialidade</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 text-foreground">{row.date}</td>
                  <td className="px-5 py-3 text-foreground">{row.type}</td>
                  <td className="px-5 py-3 text-muted-foreground">{row.specialty}</td>
                  <td className="px-5 py-3"><UsageStatusBadge status={row.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Cards (mobile) */}
      <div className="space-y-3 sm:hidden">
        {history.map((row) => (
          <Card key={row.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{row.date}</span>
                <UsageStatusBadge status={row.status} />
              </div>
              <p className="mt-1.5 text-sm font-semibold text-foreground">{row.type}</p>
              <p className="text-xs text-muted-foreground">{row.specialty}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ---------- Seção 5: Plano familiar ---------- */
function FamilySection({ dependents }) {
  if (!dependents?.enabled) {
    return null;
  }

  return (
    <section>
      <h3 className="text-base font-semibold text-foreground mb-4">Plano familiar</h3>
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Titular</p>
                <p className="text-sm font-semibold text-foreground capitalize">{dependents.holderName}</p>
              </div>
            </div>
            <Badge variant="outline">
              {dependents.used} de {dependents.limit} dependentes
            </Badge>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
            <Button variant="outline" disabled className="w-full sm:w-auto">
              <UserPlus className="w-4 h-4" />
              Adicionar dependente
              <span className="ml-1 text-xs">(em breve)</span>
            </Button>
            <p className="text-xs text-muted-foreground">
              A inclusão de dependentes será disponibilizada em breve.
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

/* ---------- Seção 6: Estados visuais ---------- */
function NoPlanState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center text-center py-16 px-6">
        <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-4">
          <Inbox className="w-7 h-7 text-emerald-600" />
        </div>
        <h3 className="text-base font-semibold text-foreground">Você ainda não possui um plano ativo.</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Contrate um plano para ter consultas recorrentes, créditos mensais e coberturas exclusivas com economia.
        </p>
        <Button asChild className="mt-5 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Link to={createPageUrl('Planos')}>Ver planos disponíveis</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function PendingState() {
  return (
    <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10">
      <CardContent className="flex flex-col items-center justify-center text-center py-14 px-6">
        <Clock className="w-7 h-7 text-amber-600 dark:text-amber-300 mb-4" />
        <h3 className="text-base font-semibold text-amber-900 dark:text-amber-100">Seu plano está aguardando confirmação.</h3>
        <p className="text-sm text-amber-700 dark:text-amber-200 mt-1 max-w-sm">
          A ativação pode levar alguns instantes após o pagamento. Assim que confirmado, seu plano aparecerá aqui automaticamente.
        </p>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <Card className="border-border">
      <CardContent className="flex flex-col items-center justify-center text-center py-16 px-6">
        <Loader2 className="w-7 h-7 text-emerald-600 animate-spin mb-4" />
        <h3 className="text-base font-semibold text-foreground">Carregando seus planos...</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Buscando dados reais do seu plano com segurança.
        </p>
      </CardContent>
    </Card>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <Card className="border-red-200 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/10">
      <CardContent className="flex flex-col items-center justify-center text-center py-14 px-6">
        <AlertCircle className="w-7 h-7 text-red-600 dark:text-red-300 mb-4" />
        <h3 className="text-base font-semibold text-red-900 dark:text-red-100">Não foi possível carregar seus planos.</h3>
        <p className="text-sm text-red-700 dark:text-red-200 mt-1 max-w-sm">
          {message || 'Tente novamente em alguns instantes.'}
        </p>
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          <RefreshCw className="w-4 h-4" />
          Tentar novamente
        </Button>
      </CardContent>
    </Card>
  );
}

function FailureState({ onRetry }) {
  return (
    <Card className="border-red-200 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/10">
      <CardContent className="flex flex-col items-center justify-center text-center py-14 px-6">
        <AlertCircle className="w-7 h-7 text-red-600 dark:text-red-300 mb-4" />
        <h3 className="text-base font-semibold text-red-900 dark:text-red-100">Não foi possível ativar seu plano automaticamente.</h3>
        <p className="text-sm text-red-700 dark:text-red-200 mt-1 max-w-sm">
          Tente novamente em alguns instantes. Se o problema persistir, entre em contato com o suporte.
        </p>
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          <RefreshCw className="w-4 h-4" />
          Tentar novamente
        </Button>
      </CardContent>
    </Card>
  );
}

function AccessDeniedState() {
  return (
    <Card className="border-border">
      <CardContent className="flex flex-col items-center justify-center text-center py-16 px-6">
        <Sparkles className="w-8 h-8 text-muted-foreground mb-4" />
        <h3 className="text-base font-semibold text-foreground">Área exclusiva do paciente.</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Entre com uma conta de paciente para acompanhar seus planos.
        </p>
      </CardContent>
    </Card>
  );
}

/* ---------- Página ---------- */
export default function MeusPlanos() {
  const { user, loading: authLoading } = useAuth();
  const isPatient = Boolean(user?.role === 'patient');

  const plansQuery = useQuery({
    queryKey: ['my-plans'],
    queryFn: getMyPlans,
    enabled: isPatient,
    staleTime: 60_000,
    meta: { handledError: true, severity: 'warn' },
  });

  const plans = plansQuery.data;
  const planState = plans?.state || 'no_plan';
  const isPendingState = (
    planState === 'pending_payment' ||
    planState === 'payment_confirmed' ||
    planState === 'activating_plan'
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Meus Planos</h1>
          <p className="text-sm lg:text-base text-muted-foreground mt-2">
            Acompanhe seu plano, coberturas, créditos disponíveis e histórico de uso.
          </p>
        </header>

        {authLoading ? (
          <LoadingState />
        ) : !isPatient ? (
          <AccessDeniedState />
        ) : plansQuery.isLoading ? (
          <LoadingState />
        ) : plansQuery.isError ? (
          <ErrorState
            message={plansQuery.error?.message}
            onRetry={() => plansQuery.refetch()}
          />
        ) : planState === 'no_plan' ? (
          <NoPlanState />
        ) : isPendingState ? (
          <PendingState />
        ) : planState === 'activation_failed' ? (
          <FailureState onRetry={() => plansQuery.refetch()} />
        ) : (
          <div className="space-y-10">
            <CurrentPlanCard plan={plans.currentPlan} />
            <CreditsSection credits={plans.credits} source={plans.creditsSource} />
            <CoverageSection coverage={plans.coverage} />
            <UsageHistorySection history={plans.usageHistory} />
            <FamilySection dependents={plans.dependents} />

            {/* CTAs finais */}
            <section className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Link to={createPageUrl('Planos')}>
                  <CreditCard className="w-4 h-4" />
                  Contratar novo plano
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to={createPageUrl('AgendamentoEspecialidade')}>
                  <ClipboardList className="w-4 h-4" />
                  Ver consultas disponíveis
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </Button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
