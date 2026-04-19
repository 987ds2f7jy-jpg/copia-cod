import React, { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/components/AuthContext';
import { createPageUrl } from '@/utils';
import { entities } from '@/client-api/readModels';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, ArrowRight, CheckCircle, Stethoscope,
  Star, Loader2, Clock, AlertCircle, Zap, Calendar as CalendarDaysIcon
} from 'lucide-react';
import { format, addDays, addHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  validateSchedulingWindow, computeAvailableSlots,
  buildDatetime
} from '@/lib/scheduling';
import { createAppointmentRequest } from '@/client-api/appointments';
import { quoteServicePricingRequest } from '@/client-api/pricing';
import { formatMoney } from '@/client-api/payments';
import PaymentStep from '@/components/payments/PaymentStep';

function AgendamentoPerfilInner() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const professionalId = searchParams.get('professional');

  // All hooks before any conditional return
  const [step, setStep] = useState(1);
  const [appointmentType, setAppointmentType] = useState('standard');
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [symptoms, setSymptoms] = useState('');
  const [submitError, setSubmitError] = useState(null);
  const [createdAppointment, setCreatedAppointment] = useState(null);
  const [appointmentPayment, setAppointmentPayment] = useState(null);

  const { data: publicProfile, isLoading: loadingPublic } = useQuery({
    queryKey: ['pub-prof', professionalId],
    queryFn: async () => {
      const list = await entities.ProfessionalPublicProfile.filter({ id: professionalId, status: 'approved' });
      return list?.[0] || null;
    },
    enabled: !!professionalId,
  });

  const privateProfileId = publicProfile?.professional_profile_id;

  const { data: availabilitySlots = [] } = useQuery({
    queryKey: ['avail-slots', privateProfileId],
    queryFn: () => entities.AvailabilitySlot.filter({ professional_id: privateProfileId }),
    enabled: !!privateProfileId,
  });

  const { data: bookedAppointments = [] } = useQuery({
    queryKey: ['booked-appts', privateProfileId],
    queryFn: () => entities.Appointment.filter({
      professional_id: privateProfileId,
      status: 'CONFIRMADO',
    }),
    enabled: !!privateProfileId,
  });

  const prioritySlots = useMemo(() => {
    if (!selectedDate) return [];
    const now = new Date();
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const bookedSet = new Set(bookedAppointments.map(a => a.scheduled_datetime).filter(Boolean));
    const slots = [];
    for (let h = 8; h < 18; h++) {
      for (let m = 0; m < 60; m += 20) {
        const time = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        const dt = buildDatetime(dateStr, time);
        const dtDate = new Date(dt);
        const minDt = addHours(now, 1);
        const maxDt = addHours(now, 36);
        if (dtDate < minDt || dtDate > maxDt) continue;
        if (bookedSet.has(dt)) continue;
        slots.push(time);
      }
    }
    return slots;
  }, [selectedDate, bookedAppointments]);

  const standardSlots = useMemo(() => {
    if (!selectedDate || !privateProfileId) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const bookedDatetimes = bookedAppointments.map(a => a.scheduled_datetime).filter(Boolean);
    const slots = computeAvailableSlots(availabilitySlots, bookedDatetimes, dateStr);
    return slots.filter(time => {
      const dt = buildDatetime(dateStr, time);
      return validateSchedulingWindow(dt).valid;
    });
  }, [selectedDate, availabilitySlots, bookedAppointments, privateProfileId]);

  const availableSlots = appointmentType === 'priority' ? prioritySlots : standardSlots;

  const { data: serviceQuote, isLoading: quoteLoading, error: quoteError } = useQuery({
    queryKey: ['service-pricing', 'appointment-profile', privateProfileId, appointmentType],
    queryFn: () => quoteServicePricingRequest({
      flow: 'appointment_profile',
      professionalProfileId: privateProfileId,
      priority: appointmentType === 'priority',
    }),
    enabled: step === 2 && Boolean(privateProfileId),
  });

  const weekdaysWithSlots = useMemo(() => {
    return new Set(availabilitySlots.map(s => s.weekday));
  }, [availabilitySlots]);

  const createAppointment = useMutation({
    mutationFn: async (data) => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const scheduledDatetime = buildDatetime(dateStr, selectedTime);

      if (data.appointment_type !== 'priority') {
        const validation = validateSchedulingWindow(scheduledDatetime);
        if (!validation.valid) throw new Error(validation.reason);
      } else {
        const now = new Date();
        const dt = new Date(scheduledDatetime);
        if (dt <= addHours(now, 1)) throw new Error('Horário muito próximo. Escolha um horário com ao menos 1h de antecedência.');
        if (dt > addHours(now, 36)) throw new Error('Consulta prioritária disponível apenas para as próximas 36h.');
      }

      const existing = await entities.Appointment.filter({
        professional_id: privateProfileId,
        scheduled_datetime: scheduledDatetime,
        status: 'CONFIRMADO',
      });
      if (existing && existing.length > 0) {
        throw new Error('Este horário acabou de ser ocupado. Por favor, escolha outro.');
      }

      return createAppointmentRequest({
        professionalProfileId: privateProfileId,
        specialty: publicProfile?.specialty || '',
        date: dateStr,
        time: selectedTime,
        symptoms: data.symptoms || '',
        priority: data.appointment_type === 'priority',
      });
    },
    onSuccess: (result) => {
      setSubmitError(null);
      setCreatedAppointment(result?.appointment || null);
      setAppointmentPayment(result?.payment || result?.appointment?.payment || null);
      queryClient.invalidateQueries({ queryKey: ['patientAppointments'] });
      queryClient.invalidateQueries({ queryKey: ['booked-appts', privateProfileId] });
      setStep(3);
    },
    onError: (err) => {
      setSubmitError(err.message || 'Não foi possível confirmar o agendamento. Tente novamente.');
    },
  });

  // Guards after all hooks
  if (user?.role === 'professional') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center gap-4">
        <AlertCircle className="w-14 h-14 text-amber-400" />
        <h2 className="text-xl font-semibold text-gray-900">Ação não permitida</h2>
        <p className="text-gray-500 max-w-sm">
          Para agendar uma consulta, crie ou utilize uma conta de paciente.
        </p>
        <Button onClick={() => navigate(createPageUrl('Home'))} variant="outline">
          Voltar ao início
        </Button>
      </div>
    );
  }

  if (loadingPublic) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!publicProfile) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <Stethoscope className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Profissional não encontrado</h2>
          <Button onClick={() => navigate(createPageUrl('Especialidades'))} className="mt-4">
            Ver todos os profissionais
          </Button>
        </div>
      </div>
    );
  }

  const isDateDisabled = (date) => {
    const now = new Date();
    if (appointmentType === 'priority') {
      const maxDt = addHours(now, 36);
      const dayStart = new Date(date); dayStart.setHours(0,0,0,0);
      const maxDay = new Date(maxDt); maxDay.setHours(23,59,59,999);
      return dayStart < new Date(now.toDateString()) || date > maxDay;
    }
    const minDate = addHours(now, 36);
    const maxDate = addDays(now, 14);
    if (date < minDate || date > maxDate) return true;
    return !weekdaysWithSlots.has(date.getDay());
  };

  const handleSubmit = () => {
    if (!user || !publicProfile || !selectedDate || !selectedTime) return;
    setSubmitError(null);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const scheduledDatetime = buildDatetime(dateStr, selectedTime);
    const isPriority = appointmentType === 'priority';

    createAppointment.mutate({
      appointment_type: isPriority ? 'priority' : 'PERFIL',
      date: dateStr,
      time: selectedTime,
      symptoms,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        {/* Progress */}
        <div className="mb-8 flex items-center justify-center gap-3">
          {['Escolher horário', 'Confirmar', 'Concluído'].map((label, i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
                  step > i + 1 ? 'bg-emerald-500 text-white' : step === i + 1 ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {step > i + 1 ? <CheckCircle className="w-5 h-5" /> : i + 1}
                </div>
                <span className="text-xs text-gray-500 hidden sm:block">{label}</span>
              </div>
              {i < 2 && <div className={`h-0.5 w-16 ${step > i + 1 ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* Professional card */}
        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
              {publicProfile.photo_url
                ? <img src={publicProfile.photo_url} alt={publicProfile.full_name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><Stethoscope className="w-7 h-7 text-gray-300" /></div>
              }
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {publicProfile.profession === 'Medicina' ? 'Dr(a). ' : ''}{publicProfile.full_name}
              </h3>
              <p className="text-sm text-gray-500">{publicProfile.specialty}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                <span className="text-sm">{publicProfile.rating?.toFixed(1) || '—'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>

          {/* Step 1: Data e Hora */}
          {step === 1 && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Escolha data e horário</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Type selector */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button
                    onClick={() => { setAppointmentType('standard'); setSelectedDate(null); setSelectedTime(null); }}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      appointmentType === 'standard' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <CalendarDaysIcon className={`w-5 h-5 mb-2 ${appointmentType === 'standard' ? 'text-emerald-600' : 'text-gray-400'}`} />
                    <div className={`font-semibold text-sm ${appointmentType === 'standard' ? 'text-emerald-700' : 'text-gray-700'}`}>Padrão</div>
                    <div className="text-xs text-gray-500 mt-0.5">Agendamento com 36h+ de antecedência</div>
                    {publicProfile.price_standard > 0 && (
                      <div className={`text-sm font-bold mt-1 ${appointmentType === 'standard' ? 'text-emerald-600' : 'text-gray-600'}`}>
                        R$ {publicProfile.price_standard.toFixed(2)}
                      </div>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      if (!publicProfile.prioritario_ativo) return;
                      setAppointmentType('priority'); setSelectedDate(null); setSelectedTime(null);
                    }}
                    disabled={!publicProfile.prioritario_ativo}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      !publicProfile.prioritario_ativo
                        ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                        : appointmentType === 'priority'
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Zap className={`w-5 h-5 mb-2 ${appointmentType === 'priority' ? 'text-amber-500' : 'text-gray-400'}`} />
                    <div className={`font-semibold text-sm ${appointmentType === 'priority' ? 'text-amber-700' : 'text-gray-700'}`}>
                      Prioritária
                      {!publicProfile.prioritario_ativo && <span className="ml-1 text-xs font-normal text-gray-400">(indisponível)</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">Próximas 36h · Requer aceite</div>
                    {publicProfile.price_priority > 0 && (
                      <div className={`text-sm font-bold mt-1 ${appointmentType === 'priority' ? 'text-amber-600' : 'text-gray-600'}`}>
                        R$ {publicProfile.price_priority.toFixed(2)}
                      </div>
                    )}
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label className="mb-2 block">Data</Label>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(d) => { setSelectedDate(d); setSelectedTime(null); }}
                      locale={ptBR}
                      disabled={isDateDisabled}
                      className="rounded-xl border w-fit"
                    />
                    {availabilitySlots.length === 0 && privateProfileId && (
                      <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Profissional não configurou disponibilidade ainda.
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="mb-2 block">
                      {selectedDate
                        ? `Horários — ${format(selectedDate, "EEE, dd/MM", { locale: ptBR })}`
                        : 'Selecione uma data primeiro'}
                    </Label>
                    {selectedDate && availableSlots.length === 0 && (
                      <p className="text-sm text-gray-500 py-4">Nenhum horário disponível neste dia.</p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot}
                          onClick={() => setSelectedTime(slot)}
                          className={`p-3 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${
                            selectedTime === slot ? 'bg-emerald-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <Button
                    onClick={() => setStep(2)}
                    disabled={!selectedDate || !selectedTime}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Continuar
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Confirmação */}
          {step === 2 && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Confirmar agendamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-gray-50 rounded-xl mb-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Data</span>
                    <span className="font-medium">{selectedDate && format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Horário</span>
                    <span className="font-medium">{selectedTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Especialidade</span>
                    <span className="font-medium">{publicProfile.specialty}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tipo</span>
                    <span className="font-medium">
                      {appointmentType === 'priority'
                        ? <span className="flex items-center gap-1 text-amber-600"><Zap className="w-3.5 h-3.5" />Prioritária</span>
                        : <span className="flex items-center gap-1 text-emerald-600"><CalendarDaysIcon className="w-3.5 h-3.5" />Padrão</span>
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Valor</span>
                    <span className="font-semibold text-emerald-600">
                      {quoteLoading
                        ? 'Carregando valor oficial...'
                        : serviceQuote?.grossPrice
                        ? formatMoney(serviceQuote.grossPrice)
                        : 'A definir'}
                    </span>
                  </div>
                </div>

                {quoteError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    {quoteError.message || 'Nao foi possivel carregar o valor oficial.'}
                  </div>
                )}

                <div>
                  <Label className="mb-2 block">Motivo / Sintomas (opcional)</Label>
                  <Textarea
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="Descreva brevemente o motivo da consulta..."
                    className="min-h-[100px]"
                  />
                </div>

                {submitError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    {submitError}
                  </div>
                )}

                <div className="flex justify-between mt-6">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={createAppointment.isPending || quoteLoading || Boolean(quoteError)}
                    className={appointmentType === 'priority' ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}
                  >
                    {createAppointment.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {appointmentType === 'priority' ? 'Solicitar Consulta Prioritária' : 'Confirmar Agendamento'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Sucesso */}
          {step === 3 && (
            appointmentPayment?.status !== 'paid' ? (
              <PaymentStep
                payment={appointmentPayment}
                ownerType="appointment"
                ownerId={createdAppointment?.id}
                title="Pagamento do agendamento"
                description="Sua consulta foi registrada, mas so sera liberada apos a confirmacao do pagamento."
                paidTitle="Pagamento confirmado"
                paidDescription="Agora sua consulta esta liberada no sistema."
                continueLabel="Ver minhas consultas"
                onPaid={(paidPayment) => {
                  setAppointmentPayment(paidPayment);
                  queryClient.invalidateQueries({ queryKey: ['patientAppointments'] });
                }}
                onContinue={() => navigate(createPageUrl('DashboardPaciente'))}
              />
            ) : (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-8 text-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
                  appointmentType === 'priority' ? 'bg-amber-100' : 'bg-emerald-100'
                }`}>
                  {appointmentType === 'priority'
                    ? <Zap className="w-10 h-10 text-amber-500" />
                    : <CheckCircle className="w-10 h-10 text-emerald-600" />
                  }
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {appointmentType === 'priority' ? 'Solicitação Enviada!' : 'Agendamento Confirmado!'}
                </h2>
                <p className="text-gray-500 mb-2">
                  {appointmentType === 'priority'
                    ? `Sua solicitação de consulta prioritária foi enviada para ${publicProfile.profession === 'Medicina' ? 'Dr(a). ' : ''}${publicProfile.full_name}.`
                    : `Sua consulta com ${publicProfile.profession === 'Medicina' ? 'Dr(a). ' : ''}${publicProfile.full_name} foi confirmada.`
                  }
                </p>
                {appointmentType === 'priority' && (
                  <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-start gap-2 text-left">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    O profissional precisa aceitar sua solicitação. Você será notificado quando isso acontecer.
                  </div>
                )}
                <div className="p-4 bg-gray-50 rounded-xl text-left mb-6 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Data</span>
                    <span className="font-medium">{selectedDate && format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Horário</span>
                    <span className="font-medium">{selectedTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    {appointmentType === 'priority'
                      ? <Badge className="bg-amber-100 text-amber-700">Aguardando aceite</Badge>
                      : <Badge className="bg-emerald-100 text-emerald-700">Confirmado</Badge>
                    }
                  </div>
                </div>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={() => navigate(createPageUrl('DashboardPaciente'))}>
                    Ver Minhas Consultas
                  </Button>
                  <Button
                    onClick={() => navigate(createPageUrl('Home'))}
                    className={appointmentType === 'priority' ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}
                  >
                    Voltar ao Início
                  </Button>
                </div>
              </CardContent>
            </Card>
            )
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default function AgendamentoPerfil() {
  return (
    <ProtectedRoute>
      <AgendamentoPerfilInner />
    </ProtectedRoute>
  );
}
