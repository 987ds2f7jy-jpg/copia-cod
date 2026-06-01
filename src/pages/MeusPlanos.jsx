import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Sparkles, CheckCircle2, XCircle, Calendar, RefreshCw, CreditCard,
  Users, UserPlus, Clock, ShieldCheck, Stethoscope, Baby, Brain,
  Apple, Dumbbell, ClipboardList, AlertCircle, ChevronRight, Inbox,
} from 'lucide-react';
import { useAuth } from '@/components/AuthContext';

/* =========================================================================
 * MOCKS LOCAIS — substituir por API real depois (Codex)
 * Estrutura pensada para troca direta por respostas de backend.
 * ========================================================================= */

// Estado visual padrão da página: 'ativo' | 'sem_plano' | 'pendente' | 'falha'
const MOCK_PLAN_STATE = 'ativo';

const mockPlan = {
  name: 'Familiar',
  status: 'Ativo',
  price: 'R$ 249,90/mês',
  contractedAt: '01/03/2026',
  nextRenewal: '01/07/2026',
  renewalDay: 1,
};

const mockCredits = [
  { id: 'clinico', label: 'Clínico Geral', icon: Stethoscope, available: 1, used: 0, included: true },
  { id: 'pediatria', label: 'Pediatria', icon: Baby, available: 1, used: 0, included: true },
  { id: 'psicologia', label: 'Psicologia', icon: Brain, available: 0, used: 0, included: false },
  { id: 'nutricao', label: 'Nutrição', icon: Apple, available: 0, used: 0, included: false },
  { id: 'educacao_fisica', label: 'Educação Física', icon: Dumbbell, available: 0, used: 0, included: false },
];

const mockCoverage = {
  included: [
    'Consulta com clínico geral',
    'Pediatria',
    'Ginecologia',
    'Pronto atendimento 24h',
  ],
  notIncluded: [
    'Psicologia semanal',
    'Nutrição',
    'Educação física',
    'Serviços extras',
    'Consulta por perfil do profissional',
  ],
};

const mockUsageHistory = [
  { id: 1, date: '28/05/2026', type: 'Consulta', specialty: 'Clínico Geral', status: 'Usado' },
  { id: 2, date: '01/05/2026', type: 'Renovação mensal', specialty: 'Créditos renovados', status: 'Concluído' },
];

const mockDependents = {
  holder: 'wesley paciente teste',
  current: 0,
  max: 3,
  list: [],
};

/* ========================================================================= */

function PlanStatusBadge({ status }) {
  const map = {
    Ativo: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    Pendente: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    Inativo: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] || map.Inativo}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status}
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
    { icon: Calendar, label: 'Contratação', value: plan.contractedAt },
    { icon: RefreshCw, label: 'Próxima renovação', value: plan.nextRenewal },
    { icon: Clock, label: 'Dia de renovação', value: `Todo dia ${plan.renewalDay}` },
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

        <p className="mt-4 text-2xl font-bold text-foreground">{plan.price}</p>

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
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
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
function CreditsSection({ credits }) {
  return (
    <section>
      <h3 className="text-base font-semibold text-foreground mb-4">Créditos disponíveis</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {credits.map((credit) => {
          const total = credit.available + credit.used;
          const pct = total > 0 ? (credit.available / total) * 100 : 0;
          return (
            <Card key={credit.id} className={!credit.included ? 'opacity-70' : ''}>
              <CardContent className="p-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <credit.icon className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-300" />
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
                <p className="text-sm font-semibold text-foreground capitalize">{dependents.holder}</p>
              </div>
            </div>
            <Badge variant="outline">
              {dependents.current} de {dependents.max} dependentes
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

function FailureState() {
  return (
    <Card className="border-red-200 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/10">
      <CardContent className="flex flex-col items-center justify-center text-center py-14 px-6">
        <AlertCircle className="w-7 h-7 text-red-600 dark:text-red-300 mb-4" />
        <h3 className="text-base font-semibold text-red-900 dark:text-red-100">Não foi possível ativar seu plano automaticamente.</h3>
        <p className="text-sm text-red-700 dark:text-red-200 mt-1 max-w-sm">
          Tente novamente em alguns instantes. Se o problema persistir, entre em contato com o suporte.
        </p>
        <Button variant="outline" className="mt-5">
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

  // Estado visual mockado. Trocar por dado real depois (Codex).
  const [planState] = useState(MOCK_PLAN_STATE);

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
          <Card><CardContent className="py-16" /></Card>
        ) : !isPatient ? (
          <AccessDeniedState />
        ) : planState === 'sem_plano' ? (
          <NoPlanState />
        ) : planState === 'pendente' ? (
          <PendingState />
        ) : planState === 'falha' ? (
          <FailureState />
        ) : (
          <div className="space-y-10">
            <CurrentPlanCard plan={mockPlan} />
            <CreditsSection credits={mockCredits} />
            <CoverageSection coverage={mockCoverage} />
            <UsageHistorySection history={mockUsageHistory} />
            <FamilySection dependents={mockDependents} />

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
