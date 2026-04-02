import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/components/AuthContext';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import PullToRefresh from '@/components/PullToRefresh';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Calendar, Clock, Video, Star, MessageSquare,
  Stethoscope, CheckCircle, XCircle, ArrowRight,
  Loader2, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function DashboardPacienteInner() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reviewModal, setReviewModal] = useState({ open: false, appointment: null });
  const [reviewData, setReviewData] = useState({ rating: 5, comment: '' });
  const [cancellingId, setCancellingId] = useState(null);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['patientAppointments', user?.id],
    queryFn: () => base44.entities.Appointment.filter({ patient_id: user.id }, '-scheduled_datetime'),
    enabled: !!user?.id,
  });

  // Fetch existing reviews to prevent duplicates
  const { data: myReviews = [] } = useQuery({
    queryKey: ['patientReviews', user?.id],
    queryFn: () => base44.entities.Review.filter({ patient_id: user.id }),
    enabled: !!user?.id,
  });

  const reviewedAppointmentIds = new Set(myReviews.map(r => r.appointment_id));

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['patientAppointments', user?.id] });
  };

  const cancelAppointment = useMutation({
    mutationFn: (id) => base44.entities.Appointment.update(id, { status: 'CANCELADO' }),
    onMutate: (id) => setCancellingId(id),
    onSettled: () => {
      setCancellingId(null);
      queryClient.invalidateQueries({ queryKey: ['patientAppointments', user?.id] });
    },
  });

  const submitReview = useMutation({
    mutationFn: async (data) => {
      // Guard: prevent duplicate review per appointment
      const existing = await base44.entities.Review.filter({ appointment_id: data.appointment_id, patient_id: data.patient_id });
      if (existing.length > 0) throw new Error('Você já avaliou esta consulta.');
      return base44.entities.Review.create(data);
    },
    onSuccess: async (_, vars) => {
      // Recalculate and update professional's rating
      const allReviews = await base44.entities.Review.filter({ professional_id: vars.professional_id });
      if (allReviews.length > 0) {
        const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
        // Try ProfessionalProfile first, then Professional
        try {
          await base44.entities.ProfessionalProfile.update(vars.professional_id, {
            rating: Math.round(avg * 10) / 10,
            total_reviews: allReviews.length,
          });
        } catch {
          await base44.entities.Professional.update(vars.professional_id, {
            rating: Math.round(avg * 10) / 10,
            total_reviews: allReviews.length,
          });
        }
      }
      setReviewModal({ open: false, appointment: null });
      setReviewData({ rating: 5, comment: '' });
      queryClient.invalidateQueries({ queryKey: ['patientAppointments', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['patientReviews', user?.id] });
    },
  });

  const handleReviewSubmit = () => {
    if (!reviewModal.appointment || !user) return;
    
    submitReview.mutate({
      patient_id: user.id,
      patient_name: user.full_name,
      professional_id: reviewModal.appointment.professional_id,
      appointment_id: reviewModal.appointment.id,
      rating: reviewData.rating,
      comment: reviewData.comment,
    });
  };

  // Timezone-safe date comparison: compare date strings, not Date objects
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingAppointments = appointments.filter(a => {
    const dateStr = a.scheduled_datetime?.slice(0, 10) || a.date;
    const activeStatuses = ['pending', 'confirmed', 'in_progress', 'SOLICITADO', 'CONFIRMADO'];
    return activeStatuses.includes(a.status) && (dateStr >= todayStr || a.status === 'in_progress');
  });
  const pastAppointments = appointments.filter(a => {
    const dateStr = a.scheduled_datetime?.slice(0, 10) || a.date;
    return ['completed', 'CONCLUIDO', 'EXPIRADO'].includes(a.status) || 
      (dateStr < todayStr && !['in_progress', 'cancelled', 'CANCELADO', 'SOLICITADO', 'CONFIRMADO'].includes(a.status));
  });
  const cancelledAppointments = appointments.filter(a => ['cancelled', 'CANCELADO'].includes(a.status));

  const getStatusBadge = (status) => {
    const styles = {
      SOLICITADO: 'bg-amber-100 text-amber-700',
      CONFIRMADO: 'bg-emerald-100 text-emerald-700',
      CANCELADO: 'bg-red-100 text-red-700',
      CONCLUIDO: 'bg-gray-100 text-gray-700',
      EXPIRADO: 'bg-gray-100 text-gray-500',
      pending: 'bg-amber-100 text-amber-700',
      confirmed: 'bg-emerald-100 text-emerald-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-gray-100 text-gray-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    const labels = {
      SOLICITADO: 'Aguardando especialista',
      CONFIRMADO: 'Confirmada',
      CANCELADO: 'Cancelada',
      CONCLUIDO: 'Concluída',
      EXPIRADO: 'Expirada',
      pending: 'Pendente',
      confirmed: 'Confirmada',
      in_progress: 'Em andamento',
      completed: 'Concluída',
      cancelled: 'Cancelada',
    };
    return <Badge className={styles[status] || 'bg-gray-100 text-gray-600'}>{labels[status] || status}</Badge>;
  };

  const getTypeLabel = (type) => {
    const labels = {
      PERFIL: 'Por Especialidade',
      ESPECIALIDADE: 'Por Especialidade',
      IMEDIATO: 'Consulta Agora',
      padrao: 'Por Especialidade',
      prioritario: 'Prioritária',
      especialidade: 'Por Especialidade',
      plantao: 'Plantão',
      standard: 'Por Especialidade',
      priority: 'Prioritária',
      instant: 'Imediata',
    };
    return labels[type] || type;
  };

  const canEnterConsult = (appt) => {
    const isActive = ['CONFIRMADO', 'confirmed', 'em_atendimento', 'in_progress'].includes(appt.status);
    if (!isActive) return false;
    const dtStr = appt.scheduled_datetime || appt.datetime;
    if (!dtStr) return true; // sem horário: permitir entrar
    const now = new Date();
    const dt = new Date(dtStr);
    const from = new Date(dt.getTime() - 5 * 60 * 1000);
    const to = new Date(dt.getTime() + 30 * 60 * 1000);
    return now >= from && now <= to;
  };

  const handleEnterConsult = (appointment) => {
    if (appointment.consulta_id) {
      navigate(`/consulta/${appointment.consulta_id}`);
    } else if (appointment.meeting_link) {
      window.open(appointment.meeting_link, '_blank');
    } else {
      // Buscar consulta pelo patient_id como fallback
      base44.entities.Consulta.filter({ paciente_id: user.id }).then(cs => {
        const active = cs.find(c => ['em_atendimento', 'aguardando', 'in_progress'].includes(c.status));
        if (active) navigate(`/consulta/${active.id}`);
      });
    }
  };

  const AppointmentCard = ({ appointment, showActions = true }) => (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-card">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="w-16 h-16 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
            <Stethoscope className="w-8 h-8 text-emerald-600" />
          </div>
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <h3 className="font-semibold text-foreground">
                Dr(a). {appointment.professional_name}
              </h3>
              {getStatusBadge(appointment.status)}
            </div>
            <p className="text-sm text-muted-foreground mb-3">{appointment.specialty}</p>
            
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {(() => {
                  const dateStr = appointment.scheduled_datetime?.slice(0, 10) || appointment.date;
                  if (!dateStr) return '—';
                  const [y, m, d] = dateStr.split('-').map(Number);
                  return format(new Date(y, m - 1, d), "dd 'de' MMMM", { locale: ptBR });
                })()}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {appointment.scheduled_datetime?.substring(11, 16) || appointment.time || '—'}
              </span>
              {appointment.appointment_type && (
                <Badge variant="outline" className="text-xs">{getTypeLabel(appointment.appointment_type)}</Badge>
              )}
            </div>

            {/* Status contextual */}
            {appointment.status === 'SOLICITADO' && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Aguardando aceite de um especialista
              </div>
            )}
            {(appointment.status === 'CONFIRMADO' || appointment.status === 'confirmed') && appointment.professional_name && (
              <p className="mt-1 text-xs text-emerald-700">
                ✓ Confirmado com {appointment.professional_name}
              </p>
            )}
            {(appointment.status === 'CANCELADO' || appointment.status === 'cancelled') && appointment.cancellation_reason && (
              <p className="mt-1 text-xs text-red-600">Motivo: {appointment.cancellation_reason}</p>
            )}

            {showActions && !['cancelled', 'CANCELADO', 'CONCLUIDO', 'EXPIRADO', 'completed'].includes(appointment.status) && (
              <div className="flex gap-2 mt-4">
                {(['SOLICITADO', 'CONFIRMADO', 'confirmed', 'pending', 'em_atendimento', 'in_progress'].includes(appointment.status)) && (
                  <>
                    {canEnterConsult(appointment) && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleEnterConsult(appointment)}
                      >
                        <Video className="w-4 h-4 mr-1" />
                        Iniciar Consulta
                      </Button>
                    )}
                    {!canEnterConsult(appointment) && ['SOLICITADO', 'pending'].includes(appointment.status) && (
                      <Button size="sm" className="gradient-primary border-0 text-white" disabled>
                        <Video className="w-4 h-4 mr-1" />
                        Aguardando médico
                      </Button>
                    )}
                  </>
                )}
                {['completed', 'CONCLUIDO'].includes(appointment.status) && !reviewedAppointmentIds.has(appointment.id) && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setReviewModal({ open: true, appointment })}
                  >
                    <Star className="w-4 h-4 mr-1" />
                    Avaliar
                  </Button>
                )}
                {['completed', 'CONCLUIDO'].includes(appointment.status) && reviewedAppointmentIds.has(appointment.id) && (
                  <span className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Avaliada
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">
            Olá, {user.full_name?.split(' ')[0]}!
          </h1>
          <p className="text-muted-foreground">Gerencie suas consultas e agendamentos</p>
        </div>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <Link to={createPageUrl('ConsultaAgora')}>
            <Card className="border-0 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Consulta Agora</p>
                  <p className="text-xs text-gray-500">Atendimento imediato</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to={createPageUrl('AgendamentoEspecialidade')}>
            <Card className="border-0 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Agendar</p>
                  <p className="text-xs text-gray-500">Nova consulta</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to={createPageUrl('PergunteEspecialista')}>
            <Card className="border-0 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Perguntar</p>
                  <p className="text-xs text-gray-500">Tire dúvidas</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Appointments Tabs */}
        <Tabs defaultValue="proximas" className="w-full">
          <TabsList className="w-full bg-card shadow-sm rounded-xl p-1 mb-6">
            <TabsTrigger value="proximas" className="flex-1 text-xs sm:text-sm">
              Próximas ({upcomingAppointments.length})
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex-1 text-xs sm:text-sm">
              Histórico ({pastAppointments.length})
            </TabsTrigger>
            <TabsTrigger value="canceladas" className="flex-1 text-xs sm:text-sm">
              Canceladas ({cancelledAppointments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="proximas">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <Card key={i} className="border-0 shadow-sm animate-pulse">
                    <CardContent className="p-6">
                      <div className="flex gap-4">
                        <div className="w-16 h-16 bg-gray-200 rounded-xl" />
                        <div className="flex-1 space-y-3">
                          <div className="h-5 bg-gray-200 rounded w-1/3" />
                          <div className="h-4 bg-gray-200 rounded w-1/4" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : upcomingAppointments.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-12 text-center">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Nenhuma consulta agendada
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Agende uma consulta com um de nossos especialistas
                  </p>
                  <Link to={createPageUrl('AgendamentoEspecialidade')}>
                    <Button className="gradient-primary border-0 text-white">
                      Agendar Consulta
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {upcomingAppointments.map((appointment, index) => (
                  <motion.div
                    key={appointment.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <AppointmentCard appointment={appointment} />
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="historico">
            {pastAppointments.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-12 text-center">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Nenhuma consulta no histórico</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {pastAppointments.map((appointment) => (
                  <AppointmentCard key={appointment.id} appointment={appointment} showActions={false} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="canceladas">
            {cancelledAppointments.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-12 text-center">
                  <XCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Nenhuma consulta cancelada</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {cancelledAppointments.map((appointment) => (
                  <AppointmentCard key={appointment.id} appointment={appointment} showActions={false} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Review Modal */}
        <Dialog open={reviewModal.open} onOpenChange={(open) => setReviewModal({ ...reviewModal, open })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Avaliar Consulta</DialogTitle>
              <DialogDescription>
                Como foi sua experiência com Dr(a). {reviewModal.appointment?.professional_name}?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <p className="text-sm font-medium mb-2">Nota</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setReviewData({ ...reviewData, rating: star })}
                      className="p-1"
                    >
                      <Star 
                        className={`w-8 h-8 transition-colors ${
                          star <= reviewData.rating 
                            ? 'fill-yellow-400 text-yellow-400' 
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Comentário (opcional)</p>
                <Textarea
                  value={reviewData.comment}
                  onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })}
                  placeholder="Conte como foi sua experiência..."
                />
              </div>
              <Button 
                onClick={handleReviewSubmit}
                disabled={submitReview.isPending}
                className="w-full gradient-primary border-0 text-white"
              >
                {submitReview.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Enviar Avaliação
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      </div>
    </PullToRefresh>
  );
}

export default function DashboardPaciente() {
  return (
    <ProtectedRoute>
      <DashboardPacienteInner />
    </ProtectedRoute>
  );
}