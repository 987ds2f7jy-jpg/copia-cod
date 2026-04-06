import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MeuPerfil from '@/components/dashboard/MeuPerfil';
import SolicitacoesAgendamento from '@/components/dashboard/SolicitacoesAgendamento';
import MinhasConsultasHoje from '@/components/dashboard/MinhasConsultasHoje';
import { base44 } from '@/api/base44Client';
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
import { buildConsultaFromAppointment, buildConsultaFromQueueEntry, createConsultaRecord } from '@/lib/consultas';
import { buildQuestionAnswerPayload, normalizeQuestions } from '@/lib/questions';
import {
  canWorkOnDuty,
  isProfessionalApprovedStatus,
  normalizePlantaoSpecialty,
  PLANTAO_ESPECIALIDADES,
  sendKeepaliveDutyOff,
  setProfessionalPublicDuty,
} from '@/lib/professionals';

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

  // Load professional profile — via React Query for proper loading/error states
  const { data: professional, isLoading: loadingProfessional, isError: profError } = useQuery({
    queryKey: ['myProfessionalProfile', user?.id],
    queryFn: async () => {
      let profs = await base44.entities.ProfessionalProfile.filter({ user_id: user.id });
      if (!profs || profs.length === 0) {
        profs = await base44.entities.Professional.filter({ user_id: user.id });
      }
      return profs?.[0] || null;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  // Load public profile for editing in "Meu Perfil"
  const { data: publicProfile } = useQuery({
    queryKey: ['myPublicProfile', professional?.id],
    queryFn: () => base44.entities.ProfessionalPublicProfile.filter({ professional_profile_id: professional.id }),
    enabled: !!professional?.id,
    select: (list) => list?.[0] || null,
    staleTime: 60_000,
  });

  const currentDutyStatus = sessionDutyState;

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: appointments = [], isLoading: loadingAppts } = useQuery({
    queryKey: ['profAppts', professional?.id],
    queryFn: () => base44.entities.Appointment.filter({ professional_id: professional.id }, '-date', 200),
    enabled: !!professional?.id,
  });

  // Queue filtered by normalized specialty
  const { data: queuePatients = [] } = useQuery({
    queryKey: ['queueWaiting', professional?.id, professional?.specialty],
    queryFn: () => {
      const normalized = normalizePlantaoSpecialty(professional?.specialty);
      return base44.entities.Queue.filter({ specialty: normalized, status: 'waiting' });
    },
    enabled: !!professional?.id && !!professional?.specialty && canWorkOnDuty(professional?.specialty) && currentDutyStatus,
    refetchInterval: currentDutyStatus ? 10000 : false,
  });

  // Consultas de hoje (todos os tipos)
  const todayStr = new Date().toISOString().slice(0, 10);

  const { data: queueAll = [] } = useQuery({
    queryKey: ['queueAll', professional?.id],
    queryFn: () => base44.entities.Queue.filter({ assigned_professional_id: professional.id }, '-created_date', 100),
    enabled: !!professional?.id,
  });

  // Perguntas pendentes para esta especialidade (inclui "Todas")
  const professionalSpecialty = professional?.specialty || '';
  const { data: pendingQuestions = [] } = useQuery({
    queryKey: ['pendingQuestions', professional?.id, professionalSpecialty],
    queryFn: async () => {
      const bySpecialty = await base44.entities.Question.filter({
        status: 'PENDENTE',
        specialty: professionalSpecialty,
      }, 'created_date', 50);
      const byAll = await base44.entities.Question.filter({
        status: 'PENDENTE',
        specialty: 'Todas',
      }, 'created_date', 50);
      // Merge and deduplicate by id
      const merged = [...bySpecialty, ...byAll];
      const seen = new Set();
      return merged.filter(q => { if (seen.has(q.id)) return false; seen.add(q.id); return true; });
    },
    enabled: !!professional?.id && !!professionalSpecialty,
    refetchInterval: 30_000,
  });

  // Perguntas já respondidas por este profissional
  const { data: answeredQuestions = [] } = useQuery({
    queryKey: ['answeredQuestions', professional?.id],
    queryFn: () => base44.entities.Question.filter({ answered_by_professional_id: professional.id }, '-answered_at', 50),
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
    queryFn: () => base44.entities.Review.filter({ professional_id: professional.id }, '-created_date', 100),
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

      sendKeepaliveDutyOff(activeDutyProfileIdRef.current);
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

  const updateAppointment = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Appointment.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profAppts'] }),
  });

  const answerQuestion = useMutation({
    mutationFn: async ({ id, answer }) => {
      // Guard: prevent answering already-answered question
      const current = await base44.entities.Question.get(id);
      if (current?.status === 'RESPONDIDA') {
        throw new Error('Esta pergunta já foi respondida.');
      }
      return base44.entities.Question.update(id, buildQuestionAnswerPayload({
        professional,
        publicProfileId: publicProfile?.id,
        answer,
      }));
    },
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
      const consulta = await createConsultaRecord(buildConsultaFromQueueEntry(queueEntry, professional));
      await base44.entities.Queue.update(queueEntry.id, {
        status: 'in_progress',
        assigned_professional_id: professional.id,
      });
      return consulta;
    },
    onSuccess: (consulta) => {
      queryClient.invalidateQueries({ queryKey: ['queueWaiting', professional?.id] });
      navigate(`/consulta/${consulta.id}`);
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
  if (loadingProfessional) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (profError || professional === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <Stethoscope className="w-12 h-12 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-900">Perfil profissional não encontrado</h2>
        <p className="text-gray-500 max-w-sm">Seu perfil ainda não foi cadastrado ou está em análise.</p>
        <a href={createPageUrl('CadastroProfissional')} className="mt-2 px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
          Completar Cadastro
        </a>
      </div>
    );
  }

  // Status gate: block pending/rejected/suspended professionals
  if (professional.status && !isProfessionalApprovedStatus(professional.status)) {
    return <ProfessionalStatusGate professional={professional} />;
  }

  const kpis = [
    {
      label: 'Consultas realizadas',
      value: completed.length,
      icon: CheckCircle,
      color: 'bg-emerald-100 text-emerald-600',
      trend: undefined,
    },
    {
      label: 'Receita do período',
      value: `R$ ${revenue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
      icon: DollarSign,
      color: 'bg-green-100 text-green-600',
      trend: trend(revenue, prevRev),
      trendLabel: `vs período anterior`,
    },
    {
      label: 'Ticket médio',
      value: `R$ ${avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
      icon: TrendingUp,
      color: 'bg-indigo-100 text-indigo-600',
    },
    {
      label: 'Nota média',
      value: avgRating > 0 ? avgRating.toFixed(1) : '—',
      icon: Star,
      color: 'bg-yellow-100 text-yellow-600',
      sub: `${reviews.length} avaliações`,
    },
    {
      label: 'Taxa de cancelamento',
      value: `${cancelRate}%`,
      icon: XCircle,
      color: cancelRate > 20 ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-500',
    },
    {
      label: 'Perguntas pendentes',
      value: pendingQ,
      icon: MessageSquare,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      label: 'Fila agora',
      value: queuePatients.length,
      icon: Users,
      color: 'bg-amber-100 text-amber-600',
    },
    {
      label: 'Total de atendimentos',
      value: appointments.filter(a => ['completed', 'CONCLUIDO'].includes(a.status)).length,
      icon: BarChart2,
      color: 'bg-sky-100 text-sky-600',
      sub: 'Acumulado',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4">
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {professional.full_name ? `Dr(a). ${professional.full_name}` : 'Painel Profissional'}
              </h1>
              <p className="text-sm text-gray-500">{professional.specialty}</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Tab navigation */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    activeTab === 'dashboard' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveTab('perfil')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    activeTab === 'perfil' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <UserCircle className="w-3.5 h-3.5" />
                  Meu Perfil
                </button>
              </div>
              {/* Period filter — only on dashboard tab */}
              {activeTab === 'dashboard' && (
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                  {PERIODS.map(p => (
                    <button
                      key={p.key}
                      onClick={() => setPeriod(p.key)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        period === p.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
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
            onConfirm={(id) => updateAppointment.mutate({ id, data: { status: 'confirmed' } })}
            onStart={(a) => {
              if (a.consulta_id) {
                navigate(`/consulta/${a.consulta_id}`);
              } else {
                createConsultaRecord(buildConsultaFromAppointment(a, professional)).then(c => {
                  base44.entities.Appointment.update(a.id, { status: 'CONFIRMADO', consulta_id: c.id });
                  navigate(`/consulta/${c.id}`);
                });
              }
            }}
          />
        </div>

        {/* Solicitações de Agendamento por Especialidade */}
        <div className="grid lg:grid-cols-2 gap-4">
          <SolicitacoesAgendamento professional={professional} />
          <MinhasConsultasHoje appointments={appointments} professional={professional} />
        </div>

        {/* Bottom row: Performance + Financial + Questions */}
        <div className="grid lg:grid-cols-3 gap-4">
          <PerformanceBlock appointments={appointments} questions={questions} professional={professional} />
          <FinancialWidget appointments={appointments} professionalId={professional?.id} />

          {/* Questions pending */}
          <div className="bg-white rounded-xl shadow-sm border-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-500" />
                Perguntas Pendentes
              </h3>
              <Badge className="bg-purple-100 text-purple-700">{pendingQ}</Badge>
            </div>
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {pendingQuestionsNormalized.length === 0 ? (
                <p className="px-5 py-6 text-sm text-gray-400 text-center">Nenhuma pendente</p>
              ) : pendingQuestionsNormalized.slice(0, 6).map(q => (
                <div key={q.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-400 truncate">{q.specialty}</p>
                    <p className="text-sm text-gray-700 line-clamp-2">{q.question_text}</p>
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
            <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-700">
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
