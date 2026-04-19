import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/components/AuthContext';
import { createPageUrl } from '@/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, ArrowRight, CheckCircle, Loader2,
  Clock, AlertCircle, Brain, Stethoscope, Leaf, Mic
} from 'lucide-react';
import { format, addDays, addHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  validateSchedulingWindow, buildDatetime, ALL_TIME_SLOTS
} from '@/lib/scheduling';
import { createAppointmentRequest } from '@/client-api/appointments';
import { quoteServicePricingRequest } from '@/client-api/pricing';
import { formatMoney } from '@/client-api/payments';
import PaymentStep from '@/components/payments/PaymentStep';

const PROFESSIONS = [
  {
    id: 'Medicina', name: 'Medicina', icon: Stethoscope,
    color: 'bg-emerald-500', description: 'Clínicos e especialistas médicos',
    specialties: [
      'Clínico Geral', 'Cardiologia', 'Neurologia', 'Ortopedia',
      'Oftalmologia', 'Pediatria', 'Dermatologia', 'Ginecologia',
      'Urologia', 'Psiquiatria', 'Endocrinologia', 'Medicina Integrativa', 'Otorrinolaringologia'
    ]
  },
  { id: 'Psicologia', name: 'Psicologia', icon: Brain, color: 'bg-violet-500', description: 'Psicólogos clínicos', specialties: ['Psicologia Clínica'] },
  { id: 'Nutrição', name: 'Nutrição', icon: Leaf, color: 'bg-lime-500', description: 'Nutricionistas clínicos', specialties: ['Nutrição Clínica'] },
  { id: 'Fonoaudiologia', name: 'Fonoaudiologia', icon: Mic, color: 'bg-fuchsia-500', description: 'Fonoaudiólogos', specialties: ['Fonoaudiologia Clínica'] },
];

function AgendamentoEspecialidadeInner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // All hooks before any conditional return
  const [selectedProfession, setSelectedProfession] = useState(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [symptoms, setSymptoms] = useState('');
  const [step, setStep] = useState(1);
  const [submitError, setSubmitError] = useState(null);
  const [createdAppointment, setCreatedAppointment] = useState(null);
  const [appointmentPayment, setAppointmentPayment] = useState(null);

  const availableSlots = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return ALL_TIME_SLOTS.filter(time => {
      const dt = buildDatetime(dateStr, time);
      return validateSchedulingWindow(dt).valid;
    });
  }, [selectedDate]);

  const { data: serviceQuote, isLoading: quoteLoading, error: quoteError } = useQuery({
    queryKey: ['service-pricing', 'appointment-specialty', selectedSpecialty],
    queryFn: () => quoteServicePricingRequest({
      flow: 'appointment_specialty',
      specialty: selectedSpecialty || '',
    }),
    enabled: step === 4 && Boolean(selectedSpecialty),
  });

  const createRequest = useMutation({
    mutationFn: async () => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const scheduledDatetime = buildDatetime(dateStr, selectedTime);
      const validation = validateSchedulingWindow(scheduledDatetime);
      if (!validation.valid) throw new Error(validation.reason);

      return createAppointmentRequest({
        professionalProfileId: null,
        specialty: selectedSpecialty,
        date: dateStr,
        time: selectedTime,
        symptoms,
        priority: false,
      });
    },
    onSuccess: (result) => {
      setSubmitError(null);
      setCreatedAppointment(result?.appointment || null);
      setAppointmentPayment(result?.payment || result?.appointment?.payment || null);
      queryClient.invalidateQueries({ queryKey: ['patientAppointments'] });
      setStep(5);
    },
    onError: (err) => {
      setSubmitError(err.message || 'Erro ao criar solicitação. Tente novamente.');
    },
  });

  // Guard after hooks
  if (user?.role === 'professional') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center gap-4">
        <AlertCircle className="w-14 h-14 text-amber-400" />
        <h2 className="text-xl font-semibold text-gray-900">Ação não permitida</h2>
        <p className="text-gray-500 max-w-sm">
          Para agendar uma consulta, crie ou utilize uma conta de paciente.
        </p>
        <Button onClick={() => navigate(createPageUrl('Home'))} variant="outline">Voltar ao início</Button>
      </div>
    );
  }

  const isDateDisabled = (date) => {
    const now = new Date();
    const minDate = addHours(now, 36);
    const maxDate = addDays(now, 14);
    return date < minDate || date > maxDate;
  };

  const handleSelectProfession = (prof) => {
    setSelectedProfession(prof);
    if (prof.specialties.length === 1) {
      setSelectedSpecialty(prof.specialties[0]);
      setStep(3);
    } else {
      setStep(2);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Agendamento por Especialidade</h1>
          <p className="text-gray-500 text-sm mt-1">
            Sua solicitação será enviada a profissionais disponíveis da especialidade escolhida.
          </p>
        </div>

        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>

          {/* Step 1: Escolher Profissão */}
          {step === 1 && (
            <div className="grid gap-4">
              {PROFESSIONS.map((prof) => {
                const Icon = prof.icon;
                return (
                  <button key={prof.id} onClick={() => handleSelectProfession(prof)} className="w-full text-left">
                    <Card className="border-0 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer">
                      <CardContent className="p-5 flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-xl ${prof.color} flex items-center justify-center flex-shrink-0`}>
                          <Icon className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{prof.name}</h3>
                          <p className="text-sm text-gray-500">{prof.description}</p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-300 ml-auto" />
                      </CardContent>
                    </Card>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Subespecialidades */}
          {step === 2 && selectedProfession && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <Button variant="ghost" size="sm" className="w-fit -ml-2 mb-1" onClick={() => setStep(1)}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                </Button>
                <CardTitle>Escolha a especialidade médica</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {selectedProfession.specialties.map((spec) => (
                    <button
                      key={spec}
                      onClick={() => { setSelectedSpecialty(spec); setStep(3); }}
                      className="p-3 rounded-xl bg-gray-50 hover:bg-emerald-50 hover:text-emerald-700 text-left text-sm font-medium text-gray-700 transition-colors border border-transparent hover:border-emerald-200"
                    >
                      {spec}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Data e Hora */}
          {step === 3 && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <Button variant="ghost" size="sm" className="w-fit -ml-2 mb-1"
                  onClick={() => setStep(selectedProfession?.specialties.length === 1 ? 1 : 2)}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                </Button>
                <CardTitle>Escolha data e horário</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-700 text-xs">{selectedSpecialty}</Badge>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  36h até 14 dias à frente · 08:00–17:40 · Slots de 20min
                </p>
              </CardHeader>
              <CardContent>
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
                  </div>
                  <div>
                    <Label className="mb-2 block">
                      {selectedDate
                        ? `Horários — ${format(selectedDate, "EEE, dd/MM", { locale: ptBR })}`
                        : 'Selecione uma data primeiro'}
                    </Label>
                    {selectedDate && availableSlots.length === 0 && (
                      <p className="text-sm text-gray-500">Nenhum horário disponível nesta data.</p>
                    )}
                    <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot}
                          onClick={() => setSelectedTime(slot)}
                          className={`p-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${
                            selectedTime === slot ? 'bg-emerald-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />{slot}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end mt-6">
                  <Button
                    onClick={() => setStep(4)}
                    disabled={!selectedDate || !selectedTime}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Continuar <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Confirmar */}
          {step === 4 && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <Button variant="ghost" size="sm" className="w-fit -ml-2 mb-1" onClick={() => setStep(3)}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                </Button>
                <CardTitle>Confirmar solicitação</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl mb-4">
                  <p className="text-sm text-blue-800 font-medium mb-1">Como funciona?</p>
                  <p className="text-sm text-blue-700">
                    Sua solicitação será enviada para profissionais de <strong>{selectedSpecialty}</strong>.
                    O primeiro que aceitar ficará responsável pelo seu atendimento.
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl mb-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Especialidade</span>
                    <span className="font-medium">{selectedSpecialty}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Data</span>
                    <span className="font-medium">{selectedDate && format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Horário</span>
                    <span className="font-medium">{selectedTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status inicial</span>
                    <Badge className="bg-amber-100 text-amber-700">Aguardando aceite</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Valor oficial</span>
                    <span className="font-semibold text-emerald-600">
                      {quoteLoading
                        ? 'Carregando...'
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
                    className="min-h-[80px]"
                  />
                </div>

                {submitError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    {submitError}
                  </div>
                )}

                <div className="flex justify-between mt-6">
                  <Button variant="outline" onClick={() => setStep(3)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                  </Button>
                  <Button
                    onClick={() => createRequest.mutate()}
                    disabled={createRequest.isPending || quoteLoading || Boolean(quoteError)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {createRequest.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Enviar Solicitação
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 5: Sucesso */}
          {step === 5 && (
            appointmentPayment?.status !== 'paid' ? (
              <PaymentStep
                payment={appointmentPayment}
                ownerType="appointment"
                ownerId={createdAppointment?.id}
                title="Pagamento da solicitacao"
                description="A solicitacao foi criada, mas so sera enviada para aceite apos pagamento confirmado."
                paidTitle="Pagamento confirmado"
                paidDescription="Sua solicitacao por especialidade esta liberada."
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
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Solicitação Enviada!</h2>
                <p className="text-gray-500 mb-2">
                  Sua solicitação foi enviada para profissionais de <strong>{selectedSpecialty}</strong>.
                </p>
                <p className="text-sm text-gray-400 mb-6">
                  Você será notificado quando um profissional aceitar o atendimento.
                </p>
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
                    <Badge className="bg-amber-100 text-amber-700">Aguardando aceite</Badge>
                  </div>
                </div>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={() => navigate(createPageUrl('DashboardPaciente'))}>
                    Ver Minhas Consultas
                  </Button>
                  <Button onClick={() => navigate(createPageUrl('Home'))} className="bg-emerald-600 hover:bg-emerald-700 text-white">
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

export default function AgendamentoEspecialidade() {
  return (
    <ProtectedRoute>
      <AgendamentoEspecialidadeInner />
    </ProtectedRoute>
  );
}
