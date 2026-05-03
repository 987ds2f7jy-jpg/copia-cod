import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MeuPerfil from '@/components/dashboard/MeuPerfil';
import SolicitacoesAgendamento from '@/components/dashboard/SolicitacoesAgendamento';
import MinhasConsultasHoje from '@/components/dashboard/MinhasConsultasHoje';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/components/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar, DollarSign, Star, Users, CheckCircle, MessageSquare,
  Loader2, Stethoscope, TrendingUp, XCircle, BarChart2, Clock,
  AlertCircle, UserCircle, LayoutDashboard
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { toast } from '@/components/ui/use-toast';

import KPICard from '@/components/dashboard/KPICard';
import RevenueChart from '@/components/dashboard/RevenueChart';
import AppointmentsChart from '@/components/dashboard/AppointmentsChart';
import QueueWidget from '@/components/dashboard/QueueWidget';
import UpcomingAppointments from '@/components/dashboard/UpcomingAppointments';
import PerformanceBlock from '@/components/dashboard/PerformanceBlock';
import FinancialWidget from '@/components/dashboard/FinancialWidget';
import PlantaoBlock from '@/components/dashboard/PlantaoBlock';
import ProfessionalStatusGate from '@/components/dashboard/ProfessionalStatusGate';
import ServicosExtras from '@/components/dashboard/ServicosExtras';
import { answerQuestionRequest } from '@/client-api/questions';
import { acceptQueueEntryRequest } from '@/client-api/queues';
import { buildQuestionAnswerPayload, normalizeQuestions } from '@/lib/questions';
import { attachLaudoContextToQueue } from '@/lib/solicitacoesExames';
import {
  canWorkOnDuty,
  isProfessionalApprovedStatus,
  normalizePlantaoSpecialty,
  PLANTAO_ESPECIALIDADES,
  setProfessionalPublicDuty,
} from '@/lib/professionals';
import { getProfessionalDashboardRequest } from '@/client-api/professionalDashboard';
import ResumeConsultationCard from '@/components/teleconsulta/ResumeConsultationCard';
import { useMyActiveConsultation } from '@/hooks/useMyActiveConsultation';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const today = () => format(new Date(), 'yyyy-MM-dd');

function filterByPeriod(appointments, period) {
  const now = new Date();
  const todayStr = today();
  if (period === 'today') return appointments.filter(a => a.date === todayStr);
  if (period === 'week') {
    const from = format(subDays(now, 6), 'yyyy-MM-dd');
    return appointments.filter(a => a.date >= from && a.date <= todayStr);
  }
  if (period === 'month') {
    const from = format(startOfMonth(now), 'yyyy-MM-dd');
    const to = format(endOfMonth(now), 'yyyy-MM-dd');
    return appointments.filter(a => a.date >= from && a.date <= to);
  }
  return appointments;
}

function prevPeriodRevenue(appointments, period) {
  const now = new Date();
  let from, to;
  if (period === 'today') {
    const y = subDays(now, 1);
    from = to = format(y, 'yyyy-MM-dd');
  } else if (period === 'week') {
    from = format(subDays(now, 13), 'yyyy-MM-dd');
    to = format(subDays(now, 7), 'yyyy-MM-dd');
  } else {
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    from = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
    to = format(endOfMonth(prevMonth), 'yyyy-MM-dd');
  }
  return appointments
    .filter(a => a.date >= from && a.date <= to && a.status === 'completed')
    .reduce((s, a) => s + (a.price || 0), 0);
}

function trend(curr, prev) {
  if (!prev) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

const PERIODS = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
  { key: 'all', label: 'Tudo' },
];

// ─── Dashboard Inner ──────────────────────────────────────────────────────────
// Especialidades habilitadas para plantão

function DashboardProfissionalInner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [period, setPeriod] = useState('month');
  const [answerModal, setAnswerModal] = useState({ open: false, question: null });
  const [answerText, setAnswerText] = useState('');
  const [sessionDutyState, setSessionDutyState] = useState(false);
  const didResetDutyOnSessionRef = useRef(false);
  const activeDutyProfileIdRef = useRef(null);
  const activeDutyStatusRef = useRef(false);
  const { data: activeConsultation } = useMyActiveConsultation({
    enabled: Boolean(user?.id),
  });

  // Load professional profile — via React Query for proper loading/error states
  const { data: professional, isLoading: loadingProfessional, isError: profError } = useQuery({
    queryKey: ['myProfessionalProfile', user?.id],
    queryFn: async () => {
      const result = await getProfessionalDashboardRequest({ appointmentsLimit: 1, includeQueue: false, includeQuestions: false, includeReviews: false });
      return result?.professional || null;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  // Load public profile for editing in "Meu Perfil"
  const { data: publicProfile, isLoading: loadingPublicProfile } = useQuery({
    queryKey: ['myPublicProfile', professional?.id],
    queryFn: async () => {
      const result = await getProfessionalDashboardRequest({ appointmentsLimit: 1, includeQueue: false, includeQuestions: false, includeReviews: false });
      return result?.publicProfile ? [result.publicProfile] : [];
    },
    enabled: !!professional?.id,
    select: (list) => list?.[0] || null,
    staleTime: 60_000,
  });

  const currentDutyStatus = sessionDutyState;

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: appointments = [], isLoading: loadingAppts } = useQuery({
    queryKey: ['profAppts', professional?.id],
    queryFn: async () => {
      const result = await getProfessionalDashboardRequest({ appointmentsLimit: 200, includeQueue: false, includeQuestions: false, includeReviews: false });
      return result?.appointments || [];
    },
    enabled: !!professional?.id,
  });

  // Queue filtered by normalized specialty
  const { data: queuePatients = [] } = useQuery({
    queryKey: ['queueWaiting', professional?.id, professional?.specialty],
    queryFn: async () => {
      const result = await getProfessionalDashboardRequest({ appointmentsLimit: 1, includeQueue: true, includeQuestions: false, includeReviews: false });
      return attachLaudoContextToQueue(result?.queueWaiting || []);
    },
    enabled: !!professional?.id && !!professional?.specialty && canWorkOnDuty(professional?.specialty) && currentDutyStatus,
    refetchInterval: currentDutyStatus ? 10000 : false,
  });

  // Consultas de hoje (todos os tipos)
  const todayStr = new Date().toISOString().slice(0, 10);

  const { data: queueAll = [] } = useQuery({
    queryKey: ['queueAll', professional?.id],
    queryFn: async () => {
      const result = await getProfessionalDashboardRequest({ appointmentsLimit: 1, includeQueue: true, includeQuestions: false, includeReviews: false });
      return result?.queueAll || [];
    },
    enabled: !!professional?.id,
  });

  // Perguntas pendentes para esta especialidade (inclui "Todas")
  const professionalSpecialty = professional?.specialty || '';
  const { data: pendingQuestions = [] } = useQuery({
    queryKey: ['pendingQuestions', professional?.id, professionalSpecialty],
    queryFn: async () => {
      const result = await getProfessionalDashboardRequest({ appointmentsLimit: 1, includeQueue: false, includeQuestions: true, includeReviews: false });
      return result?.pendingQuestions || [];
    },
    enabled: !!professional?.id && !!professionalSpecialty,
    refetchInterval: 30_000,
  });

  // Perguntas já respondidas por este profissional
  const { data: answeredQuestions = [] } = useQuery({
    queryKey: ['answeredQuestions', professional?.id],
    queryFn: async () => {
      const result = await getProfessionalDashboardRequest({ appointmentsLimit: 1, includeQueue: false, includeQuestions: true, includeReviews: false });
      return result?.answeredQuestions || [];
    },
    enabled: !!professional?.id,
  });

  const questionProfilesById = publicProfile?.id ? { [publicProfile.id]: publicProfile } : {};
  const pendingQuestionsNormalized = useMemo(
    () => normalizeQuestions(pendingQuestions, questionProfilesById),
    [pendingQuestions, publicProfile]
  );
  const answeredQuestionsNormalized = useMemo(
    () => normalizeQuestions(answeredQuestions, questionProfilesById),
    [answeredQuestions, publicProfile]
  );
  const questions = [...pendingQuestionsNormalized, ...answeredQuestionsNormalized];

  const { data: reviews = [] } = useQuery({
    queryKey: ['profReviews', professional?.id],
    queryFn: async () => {
      const result = await getProfessionalDashboardRequest({ appointmentsLimit: 1, includeQueue: false, includeQuestions: false, includeReviews: true });
      return result?.reviews || [];
    },
    enabled: !!professional?.id,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const queryClient = useQueryClient();

  const toggleDuty = useMutation({
    onMutate: (isOnDuty) => {
      setSessionDutyState(Boolean(isOnDuty));
    },
    mutationFn: async (isOnDuty) => {
      if (!publicProfile?.id) {
        throw new Error('Perfil publico nao encontrado.');
      }

      await setProfessionalPublicDuty(publicProfile.id, isOnDuty);
      return Boolean(isOnDuty);
    },
    onError: () => {
      setSessionDutyState(Boolean(publicProfile?.is_on_duty));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myPublicProfile', professional?.id] });
      queryClient.invalidateQueries({ queryKey: ['onDutyProfessionals'] });
    },
  });

  useEffect(() => {
    activeDutyProfileIdRef.current = publicProfile?.id || null;
    activeDutyStatusRef.current = currentDutyStatus;
  }, [currentDutyStatus, publicProfile?.id]);

  useEffect(() => {
    if (!publicProfile?.id) {
      setSessionDutyState(false);
      return;
    }

    if (!didResetDutyOnSessionRef.current) {
      didResetDutyOnSessionRef.current = true;

      if (publicProfile.is_on_duty) {
        setSessionDutyState(false);
        toggleDuty.mutate(false);
        return;
      }
    }

    setSessionDutyState(Boolean(publicProfile.is_on_duty));
  }, [publicProfile?.id, publicProfile?.is_on_duty]);

  useEffect(() => {
    const handlePageHide = () => {
      if (!activeDutyStatusRef.current || !activeDutyProfileIdRef.current) {
        return;
      }
    };

    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);

      if (!activeDutyStatusRef.current || !activeDutyProfileIdRef.current) {
        return;
      }

      void setProfessionalPublicDuty(activeDutyProfileIdRef.current, false);
    };
  }, []);

  const answerQuestion = useMutation({
    mutationFn: ({ id, answer }) => answerQuestionRequest({
      questionId: id,
      answerText: answer,
    }),
    onSuccess: () => {
      setAnswerModal({ open: false, question: null });
      setAnswerText('');
      queryClient.invalidateQueries({ queryKey: ['pendingQuestions'] });
      queryClient.invalidateQueries({ queryKey: ['answeredQuestions'] });
      queryClient.invalidateQueries({ queryKey: ['forumPublic'] });
      queryClient.invalidateQueries({ queryKey: ['perfil-questions'] });
    },
  });

  const acceptQueuePatient = useMutation({
    mutationFn: async (queueEntry) => {
      if (!queueEntry?.id) {
        throw new Error('Entrada da fila invalida.');
      }

      return acceptQueueEntryRequest({ queueId: queueEntry.id });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['queueWaiting'] });
      queryClient.invalidateQueries({ queryKey: ['queueAll'] });

      if (result?.consulta?.id) {
        navigate(`/consulta/${result.consulta.id}`);
      }
    },
    onError: (error) => {
      toast({
        title: 'Nao foi possivel atender a fila',
        description: error.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    },
  });

  // ── KPI calculations — memoized to avoid recalculation on every render ─────
  const { filtered, completed, cancelled, revenue, prevRev, cancelRate, avgTicket, avgRating, pendingQ } = useMemo(() => {
  const filtered = filterByPeriod(appointments, period);
  const completed = filtered.filter(a => ['completed', 'CONCLUIDO'].includes(a.status));
  const cancelled = filtered.filter(a => ['cancelled', 'CANCELADO'].includes(a.status));
    const revenue = completed.reduce((s, a) => s + (a.price || 0), 0);
    const prevRev = prevPeriodRevenue(appointments, period);
    const cancelRate = filtered.length > 0 ? Math.round((cancelled.length / filtered.length) * 100) : 0;
    const avgTicket = completed.length > 0 ? revenue / completed.length : 0;
    const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : 0;
    const pendingQ = pendingQuestions.length;
    return { filtered, completed, cancelled, revenue, prevRev, cancelRate, avgTicket, avgRating, pendingQ };
  }, [appointments, period, reviews, pendingQuestions]);

  // ── States ─────────────────────────────────────────────────────────────────
  if (loadingProfessional || (professional?.id && loadingPublicProfile)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (profError || professional === null) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4 text-center">
        <Stethoscope className="w-12 h-12 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold text-foreground">Perfil profissional não encontrado</h2>
        <p className="text-muted-foreground max-w-sm">Seu perfil ainda não foi cadastrado ou está em análise.</p>
        <a href={createPageUrl('CadastroProfissional')} className="mt-2 px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
          Completar Cadastro
        </a>
      </div>
    );
  }

  const professionalApprovalStatus = publicProfile?.status || professional?.status || '';

  // Use the public approval status as the source of truth for dashboard access.
  if (professionalApprovalStatus && !isProfessionalApprovedStatus(professionalApprovalStatus)) {
    return (
      <ProfessionalStatusGate
        professional={{
          ...professional,
          status: professionalApprovalStatus,
        }}
      />
    );
  }

  const kpis = [
    {
      label: 'Consultas realizadas',
      value: completed.length,
      icon: CheckCircle,
      color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
      trend: undefined,
    },
    {
      label: 'Receita do período',
      value: `R$ ${revenue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
      icon: DollarSign,
      color: 'bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-300',
      trend: trend(revenue, prevRev),
      trendLabel: `vs período anterior`,
    },
    {
      label: 'Ticket médio',
      value: `R$ ${avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
      icon: TrendingUp,
      color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300',
    },
    {
      label: 'Nota média',
      value: avgRating > 0 ? avgRating.toFixed(1) : '—',
      icon: Star,
      color: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-950/40 dark:text-yellow-300',
      sub: `${reviews.length} avaliações`,
    },
    {
      label: 'Taxa de cancelamento',
      value: `${cancelRate}%`,
      icon: XCircle,
      color: cancelRate > 20 ? 'bg-red-100 text-red-500 dark:bg-red-950/40 dark:text-red-300' : 'bg-muted text-muted-foreground',
    },
    {
      label: 'Perguntas pendentes',
      value: pendingQ,
      icon: MessageSquare,
      color: 'bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300',
    },
    {
      label: 'Fila agora',
      value: queuePatients.length,
      icon: Users,
      color: 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
    },
    {
      label: 'Total de atendimentos',
      value: appointments.filter(a => ['completed', 'CONCLUIDO'].includes(a.status)).length,
      icon: BarChart2,
      color: 'bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300',
      sub: 'Acumulado',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header */}
      <div className="bg-card/95 border-b border-border sticky top-0 z-30 shadow-sm backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4">
            <div>
              <h1 className="text-lg font-bold text-foreground">
                {professional.full_name ? `Dr(a). ${professional.full_name}` : 'Painel Profissional'}
              </h1>
              <p className="text-sm text-muted-foreground">{professional.specialty}</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Tab navigation */}
              <div className="flex gap-1 bg-muted rounded-xl p-1">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    activeTab === 'dashboard' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveTab('perfil')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    activeTab === 'perfil' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <UserCircle className="w-3.5 h-3.5" />
                  Meu Perfil
                </button>
              </div>
              {/* Period filter — only on dashboard tab */}
              {activeTab === 'dashboard' && (
                <div className="flex gap-1 bg-muted rounded-xl p-1">
                  {PERIODS.map(p => (
                    <button
                      key={p.key}
                      type="button"
                      aria-pressed={period === p.key}
                      onClick={() => setPeriod(p.key)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        period === p.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Meu Perfil tab */}
      {activeTab === 'perfil' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <MeuPerfil professional={professional} publicProfile={publicProfile} />
        </div>
      )}

      {activeTab === 'dashboard' && (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {activeConsultation?.hasActiveConsultation && (
          <ResumeConsultationCard
            activeConsultation={activeConsultation}
            onResume={() => navigate(activeConsultation.resumeUrl)}
          />
        )}

        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {kpis.map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="col-span-2 sm:col-span-2 lg:col-span-2">
              <KPICard {...kpi} loading={loadingAppts} />
            </motion.div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid lg:grid-cols-2 gap-4">
          <RevenueChart appointments={appointments} />
          <AppointmentsChart appointments={appointments} />
        </div>

        {/* Middle row: Plantão + Queue + Upcoming */}
        <div className="grid lg:grid-cols-3 gap-4">
          <PlantaoBlock
            professional={professional}
            isOnDuty={currentDutyStatus}
            canToggle={Boolean(publicProfile?.id)}
            queueAll={queueAll}
            appointments={appointments}
            onToggle={(v) => toggleDuty.mutate(v)}
            plantaoEspecialidades={PLANTAO_ESPECIALIDADES}
          />
          <QueueWidget
            queuePatients={currentDutyStatus ? queuePatients : []}
            onAccept={(p) => acceptQueuePatient.mutate(p)}
            accepting={acceptQueuePatient.isPending}
          />
          <UpcomingAppointments
            appointments={appointments}
            onStart={(a) => {
              if (a.consulta_id) {
                navigate(`/consulta/${a.consulta_id}`);
              } else {
                toast({
                  title: 'Consulta ainda nao vinculada',
                  description: 'Aceite a solicitacao novamente ou atualize a pagina para carregar o vinculo criado no backend.',
                  variant: 'destructive',
                });
              }
            }}
          />
        </div>

        {/* Solicitações de Agendamento + Serviços Extras */}
        <div className="grid lg:grid-cols-3 gap-4">
          <SolicitacoesAgendamento professional={professional} />
          <MinhasConsultasHoje appointments={appointments} />
          <ServicosExtras
            professional={professional}
            onAtender={(s) => {
              toast({
                title: `Solicitação de ${s.tipo === 'checkup' ? 'Check-Up' : 'Exames Específicos'}`,
                description: `Paciente: ${s.paciente_nome}. Exame: ${s.exame_solicitado}`,
              });
            }}
          />
        </div>

        {/* Bottom row: Performance + Financial + Questions */}
        <div className="grid lg:grid-cols-3 gap-4">
          <PerformanceBlock appointments={appointments} questions={questions} professional={professional} />
          <FinancialWidget appointments={appointments} professionalId={professional?.id} />

          {/* Questions pending */}
          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-500" />
                Perguntas Pendentes
              </h3>
              <Badge className="bg-purple-100 text-purple-700">{pendingQ}</Badge>
            </div>
            <div className="divide-y divide-border max-h-80 overflow-y-auto">
              {pendingQuestionsNormalized.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground text-center">Nenhuma pendente</p>
              ) : pendingQuestionsNormalized.slice(0, 6).map(q => (
                <div key={q.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground truncate">{q.specialty}</p>
                    <p className="text-sm text-foreground line-clamp-2">{q.question_text}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs px-2 h-7 shrink-0 text-purple-600 border-purple-200"
                    onClick={() => setAnswerModal({ open: true, question: q })}
                  >
                    Responder
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Answer Modal — always mounted so it can close properly */}
      <Dialog open={answerModal.open} onOpenChange={(open) => setAnswerModal(m => ({ ...m, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Responder Pergunta</DialogTitle>
            <DialogDescription>{answerModal.question?.patient_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="p-4 bg-muted/50 rounded-xl text-sm text-foreground">
              {answerModal.question?.question_text}
            </div>
            <Textarea
              value={answerText}
              onChange={e => setAnswerText(e.target.value)}
              placeholder="Digite sua resposta..."
              className="min-h-[120px]"
            />
            <Button
              onClick={() => answerQuestion.mutate({ id: answerModal.question?.id, answer: answerText })}
              disabled={!answerText.trim() || answerQuestion.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {answerQuestion.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Enviar Resposta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DashboardProfissional() {
  return (
    <ProtectedRoute requiredRole="professional">
      <DashboardProfissionalInner />
    </ProtectedRoute>
  );
}
