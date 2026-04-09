import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/components/AuthContext';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, ArrowRight, Calendar as CalendarIcon, 
  Clock, CheckCircle, Stethoscope, Star, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createAppointmentRequest } from '@/client-api/appointments';

function AgendamentoInner() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const professionalId = searchParams.get('professional');

  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [appointmentType, setAppointmentType] = useState('standard');
  const [symptoms, setSymptoms] = useState('');

  const { data: professional, isLoading: loadingProfessional } = useQuery({
    queryKey: ['professional', professionalId],
    queryFn: async () => {
      // Try ProfessionalProfile first (new entity), then Professional (legacy)
      let list = await base44.entities.ProfessionalProfile.filter({ id: professionalId });
      if (!list || list.length === 0) {
        list = await base44.entities.Professional.filter({ id: professionalId });
      }
      return list[0] || null;
    },
    enabled: !!professionalId,
  });

  const [submitError, setSubmitError] = useState(null);

  const createAppointment = useMutation({
    mutationFn: ({ professionalProfileId, date, time, symptoms, priority }) => createAppointmentRequest({
      professionalProfileId,
      specialty: professional?.specialty || '',
      date,
      time,
      symptoms,
      priority,
    }),
    onSuccess: () => {
      setSubmitError(null);
      queryClient.invalidateQueries({ queryKey: ['patientAppointments'] });
      setStep(4); // Only advance AFTER server confirms
    },
    onError: (err) => {
      setSubmitError('Não foi possível confirmar o agendamento. Tente novamente.');
      setStep(3);
    },
  });

  const availableHours = professional?.available_hours || [
    '08:00', '09:00', '10:00', '11:00', 
    '14:00', '15:00', '16:00', '17:00'
  ];

  const handleSubmit = async () => {
    if (!user || !professional || !selectedDate || !selectedTime) return;
    setSubmitError(null);
    createAppointment.mutate({
      professionalProfileId: professional.id,
      date: format(selectedDate, 'yyyy-MM-dd'),
      time: selectedTime,
      symptoms,
      priority: appointmentType === 'priority',
    });
  };

  if (loadingProfessional) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!professional) {
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

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors ${
                  step >= i 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {step > i ? <CheckCircle className="w-5 h-5" /> : i}
                </div>
                {i < 4 && (
                  <div className={`w-full h-1 mx-2 ${
                    step > i ? 'bg-emerald-500' : 'bg-muted'
                  }`} style={{ width: '80px' }} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm text-muted-foreground px-1">
            <span>Tipo</span>
            <span>Data/Hora</span>
            <span>Detalhes</span>
            <span>Confirmação</span>
          </div>
        </div>

        {/* Professional Info */}
        <Card className="border-0 shadow-sm mb-6 bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted">
                {professional.photo_url ? (
                  <img src={professional.photo_url} alt={professional.full_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Stethoscope className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Dr(a). {professional.full_name}</h3>
                <p className="text-sm text-muted-foreground">{professional.specialty}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm">{professional.rating?.toFixed(1) || '5.0'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Steps */}
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          {/* Step 1: Type Selection */}
          {step === 1 && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Escolha o tipo de consulta</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={appointmentType} onValueChange={setAppointmentType} className="space-y-4">
                  <div className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    appointmentType === 'standard' 
                      ? 'border-emerald-500 bg-emerald-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="standard" id="standard" />
                        <Label htmlFor="standard" className="cursor-pointer">
                          <p className="font-semibold text-gray-900">Consulta Padrão</p>
                          <p className="text-sm text-gray-500">Agende para uma data futura de sua escolha</p>
                        </Label>
                      </div>
                      <span className="font-bold text-emerald-600">
                        R$ {professional.price_standard?.toFixed(2) || '150,00'}
                      </span>
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    appointmentType === 'priority' 
                      ? 'border-amber-500 bg-amber-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="priority" id="priority" />
                        <Label htmlFor="priority" className="cursor-pointer">
                          <p className="font-semibold text-gray-900">Consulta Prioritária</p>
                          <p className="text-sm text-gray-500">Atendimento garantido em até 24 horas</p>
                        </Label>
                      </div>
                      <span className="font-bold text-amber-600">
                        R$ {professional.price_priority?.toFixed(2) || '250,00'}
                      </span>
                    </div>
                  </div>
                </RadioGroup>

                <div className="flex justify-end mt-6">
                  <Button onClick={() => setStep(2)} className="gradient-primary border-0 text-white">
                    Continuar
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Date & Time */}
          {step === 2 && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Escolha data e horário</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label className="mb-2 block">Data da consulta</Label>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      locale={ptBR}
                      disabled={(date) => date < new Date() || date.getDay() === 0}
                      className="rounded-xl border"
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">Horário disponível</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {availableHours.map((hour) => (
                        <button
                          key={hour}
                          onClick={() => setSelectedTime(hour)}
                          className={`p-3 rounded-xl text-sm font-medium transition-all ${
                            selectedTime === hour
                              ? 'bg-emerald-500 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                        >
                          {hour}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between mt-6">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar
                  </Button>
                  <Button 
                    onClick={() => setStep(3)} 
                    disabled={!selectedDate || !selectedTime}
                    className="gradient-primary border-0 text-white"
                  >
                    Continuar
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Details */}
          {step === 3 && (
            <Card className="border-0 shadow-sm bg-card">
              <CardHeader>
                <CardTitle>Detalhes da consulta</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-xl">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Data:</span>
                        <p className="font-medium text-foreground">
                          {selectedDate && format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Horário:</span>
                        <p className="font-medium text-foreground">{selectedTime}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tipo:</span>
                        <p className="font-medium text-foreground">
                          {appointmentType === 'standard' ? 'Consulta Padrão' : 'Consulta Prioritária'}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Valor:</span>
                        <p className="font-medium text-emerald-600">
                          R$ {(appointmentType === 'standard' 
                            ? professional.price_standard 
                            : professional.price_priority
                          )?.toFixed(2) || '150,00'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="symptoms" className="mb-2 block">
                      Descreva seus sintomas ou motivo da consulta (opcional)
                    </Label>
                    <Textarea
                      id="symptoms"
                      value={symptoms}
                      onChange={(e) => setSymptoms(e.target.value)}
                      placeholder="Ex: Dores de cabeça frequentes há 2 semanas..."
                      className="min-h-[120px]"
                    />
                  </div>
                </div>

                <div className="flex justify-between mt-6">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar
                  </Button>
                  {submitError && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {submitError}
                    </p>
                  )}
                  <Button 
                    onClick={handleSubmit}
                    disabled={createAppointment.isPending}
                    className="gradient-primary border-0 text-white"
                  >
                    {createAppointment.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Confirmar Agendamento
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Confirmation */}
          {step === 4 && (
            <Card className="border-0 shadow-sm bg-card">
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Agendamento Confirmado!
                </h2>
                <p className="text-muted-foreground mb-6">
                  Sua consulta com Dr(a). {professional.full_name} foi agendada com sucesso.
                </p>
                <div className="p-4 bg-muted rounded-xl text-left mb-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Data:</span>
                      <p className="font-medium text-foreground">
                        {selectedDate && format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Horário:</span>
                      <p className="font-medium text-foreground">{selectedTime}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 justify-center">
                  <Button 
                    variant="outline" 
                    onClick={() => navigate(createPageUrl('DashboardPaciente'))}
                  >
                    Ver Minhas Consultas
                  </Button>
                  <Button 
                    onClick={() => navigate(createPageUrl('Home'))}
                    className="gradient-primary border-0 text-white"
                  >
                    Voltar ao Início
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default function Agendamento() {
  return (
    <ProtectedRoute>
      <AgendamentoInner />
    </ProtectedRoute>
  );
}
