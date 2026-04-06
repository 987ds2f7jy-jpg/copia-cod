import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Clock, Loader2, Stethoscope, Users, Video } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/components/AuthContext';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  canWorkOnDuty,
  isProfessionalApprovedStatus,
  normalizePlantaoSpecialty,
} from '@/lib/professionals';
import {
  clearSpecificExamRedirect,
  normalizeConsultaAgoraSpecialty,
  readSpecificExamRedirect,
} from '@/lib/solicitacoesExames';

const SPECIALTIES = [
  { id: 'clinico_geral', name: 'Clinico Geral' },
  { id: 'pediatria', name: 'Pediatria' },
  { id: 'psicologia', name: 'Psicologia' },
  { id: 'psiquiatria', name: 'Psiquiatria' },
];

function buildProfessionalKey(profile) {
  return profile?.user_id || profile?.professional_profile_id || profile?.id || '';
}

function normalizeOnDutyProfessionals(publicProfiles = []) {
  const merged = new Map();

  publicProfiles.forEach((profile) => {
    if (!profile?.is_on_duty || !isProfessionalApprovedStatus(profile.status) || !canWorkOnDuty(profile.specialty)) {
      return;
    }

    const key = buildProfessionalKey(profile);
    if (!key) {
      return;
    }

    merged.set(key, {
      ...profile,
      normalizedSpecialty: normalizePlantaoSpecialty(profile.specialty),
    });
  });

  return Array.from(merged.values());
}

function ConsultaAgoraInner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState('form');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [queueEntry, setQueueEntry] = useState(null);

  const selectedSpecialtyLabel = useMemo(
    () => SPECIALTIES.find((specialty) => specialty.id === selectedSpecialty)?.name || '',
    [selectedSpecialty],
  );

  const selectedSpecialtyNormalized = useMemo(
    () => normalizePlantaoSpecialty(selectedSpecialty),
    [selectedSpecialty],
  );

  useEffect(() => {
    if (step !== 'form') {
      return;
    }

    const specialtyFromUrl = normalizeConsultaAgoraSpecialty(searchParams.get('especialidade'));
    const symptomsFromUrl = searchParams.get('sintomas') || '';
    const storedRedirect = readSpecificExamRedirect();
    const specialtyFromStorage = normalizeConsultaAgoraSpecialty(storedRedirect?.especialidade);
    const nextSpecialty = specialtyFromUrl || specialtyFromStorage;
    const nextSymptoms = symptomsFromUrl || storedRedirect?.sintomas || '';

    if (nextSpecialty && !selectedSpecialty) {
      setSelectedSpecialty(nextSpecialty);
    }

    if (nextSymptoms && !symptoms) {
      setSymptoms(nextSymptoms);
    }
  }, [searchParams, selectedSpecialty, step, symptoms]);

  const findActivePlantaoConsulta = async (patientId) => {
    if (!patientId) {
      return null;
    }

    const consultas = await base44.entities.Consulta.filter({ paciente_id: patientId }, '-created_date', 20);

    return consultas.find((consulta) =>
      consulta.tipo_consulta === 'plantao' &&
      ['aguardando', 'em_atendimento'].includes(consulta.status)
    ) || null;
  };

  const findCurrentQueueEntry = async (patientId, queueId) => {
    if (queueId) {
      const directMatch = await base44.entities.Queue.filter({ id: queueId }, undefined, 1);

      if (directMatch?.[0] && ['waiting', 'in_progress', 'em_atendimento'].includes(directMatch[0].status)) {
        return directMatch[0];
      }
    }

    const [waiting, inProgress, inAttendance] = await Promise.all([
      base44.entities.Queue.filter({ patient_id: patientId, status: 'waiting' }),
      base44.entities.Queue.filter({ patient_id: patientId, status: 'in_progress' }),
      base44.entities.Queue.filter({ patient_id: patientId, status: 'em_atendimento' }),
    ]);

    return waiting[0] || inProgress[0] || inAttendance[0] || null;
  };

  useEffect(() => {
    if (!user?.id) {
      return undefined;
    }

    let active = true;

    const restoreFlow = async () => {
      const activeConsulta = await findActivePlantaoConsulta(user.id);
      if (!active) {
        return;
      }

      if (activeConsulta) {
        navigate(`/consulta/${activeConsulta.id}`);
        return;
      }

      const currentQueue = await findCurrentQueueEntry(user.id);
      if (!active) {
        return;
      }

      if (currentQueue) {
        setQueueEntry(currentQueue);
        setStep('queue');
      } else {
        setQueueEntry(null);
        setStep('form');
      }
    };

    void restoreFlow();

    return () => {
      active = false;
    };
  }, [user?.id, navigate]);

  const { data: onDutyProfessionals = [] } = useQuery({
    queryKey: ['onDutyProfessionals'],
    queryFn: async () => {
      const publicProfiles = await base44.entities.ProfessionalPublicProfile.filter({ is_on_duty: true });
      return normalizeOnDutyProfessionals(publicProfiles);
    },
    refetchInterval: 8000,
  });

  const availableProfessionals = useMemo(() => {
    if (!selectedSpecialtyNormalized) {
      return onDutyProfessionals;
    }

    return onDutyProfessionals.filter(
      (profile) => profile.normalizedSpecialty === selectedSpecialtyNormalized,
    );
  }, [onDutyProfessionals, selectedSpecialtyNormalized]);

  const medicosDisponiveis = availableProfessionals.length;
  const hasAvailableProfessionals = medicosDisponiveis > 0;

  const { data: queueStats } = useQuery({
    queryKey: ['queueStats', selectedSpecialty],
    queryFn: async () => {
      const filters = { status: 'waiting' };

      if (selectedSpecialty) {
        filters.specialty = selectedSpecialty;
      }

      const queue = await base44.entities.Queue.filter(filters);
      return { count: queue.length, estimatedWait: queue.length * 10 };
    },
    refetchInterval: 30000,
  });

  const enterQueue = useMutation({
    mutationFn: async (payload) => {
      const currentQueue = await findCurrentQueueEntry(payload.patient_id);
      if (currentQueue) {
        return currentQueue;
      }

      const position = (queueStats?.count || 0) + 1;
      return base44.entities.Queue.create({
        ...payload,
        position,
        estimated_wait_time: position * 10,
      });
    },
    onSuccess: (nextQueueEntry) => {
      setQueueEntry(nextQueueEntry);
      setStep('queue');
      clearSpecificExamRedirect();
      queryClient.invalidateQueries({ queryKey: ['queueStats'] });
    },
  });

  const leaveQueue = useMutation({
    mutationFn: (id) => base44.entities.Queue.update(id, { status: 'cancelled' }),
    onSuccess: () => {
      setQueueEntry(null);
      setStep('form');
      clearSpecificExamRedirect();
      queryClient.invalidateQueries({ queryKey: ['queueStats'] });
    },
  });

  useEffect(() => {
    if (!queueEntry?.id) {
      return undefined;
    }

    const unsubscribe = base44.entities.Queue.subscribe((event) => {
      if (event.id !== queueEntry.id || event.type !== 'update') {
        return;
      }

      setQueueEntry(event.data);

      if (['in_progress', 'em_atendimento'].includes(event.data.status)) {
        findActivePlantaoConsulta(user?.id).then((activeConsulta) => {
          if (activeConsulta) {
            navigate(`/consulta/${activeConsulta.id}`);
          }
        });
      }
    });

    return () => unsubscribe();
  }, [queueEntry?.id, user?.id, navigate]);

  useEffect(() => {
    if (!user?.id || !queueEntry?.id) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      const activeConsulta = await findActivePlantaoConsulta(user.id);

      if (activeConsulta) {
        window.clearInterval(intervalId);
        navigate(`/consulta/${activeConsulta.id}`);
        return;
      }

      const currentQueue = await findCurrentQueueEntry(user.id, queueEntry.id);

      if (!currentQueue || currentQueue.status === 'cancelled') {
        window.clearInterval(intervalId);
        setQueueEntry(null);
        setStep('form');
        return;
      }

      setQueueEntry((previous) => {
        if (!previous) {
          return currentQueue;
        }

        const hasChanged =
          previous.status !== currentQueue.status ||
          previous.position !== currentQueue.position ||
          previous.estimated_wait_time !== currentQueue.estimated_wait_time ||
          previous.assigned_professional_id !== currentQueue.assigned_professional_id;

        return hasChanged ? currentQueue : previous;
      });
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, [queueEntry?.id, user?.id, navigate]);

  const handleJoinQueue = () => {
    if (!user || !selectedSpecialty || !hasAvailableProfessionals) {
      return;
    }

    enterQueue.mutate({
      patient_id: user.id,
      patient_name: user.full_name,
      patient_email: user.email,
      specialty: selectedSpecialty,
      symptoms,
      priority_level: 'normal',
      status: 'waiting',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700">
            <Clock className="h-4 w-4" />
            Atendimento Imediato
          </div>
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Consulta Agora</h1>
          <p className="text-gray-600">Conecte-se com um medico disponivel em minutos</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'form' && (
            <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Card className="mb-6 border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                        <Stethoscope className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {medicosDisponiveis} medicos disponiveis
                        </p>
                        <p className="text-sm text-gray-500">
                          {selectedSpecialty
                            ? `Plantao ativo em ${selectedSpecialtyLabel}`
                            : 'Prontos para atendimento'}
                        </p>
                      </div>
                    </div>
                    {queueStats && (
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Na fila</p>
                        <p className="font-semibold text-gray-900">{queueStats.count} pacientes</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle>Entrar na Fila de Atendimento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label className="mb-2 block">Especialidade desejada</Label>
                    <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Selecione a especialidade" />
                      </SelectTrigger>
                      <SelectContent>
                        {SPECIALTIES.map((specialty) => (
                          <SelectItem key={specialty.id} value={specialty.id}>
                            {specialty.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="mb-2 block">Descreva seus sintomas</Label>
                    <Textarea
                      value={symptoms}
                      onChange={(event) => setSymptoms(event.target.value)}
                      placeholder="Ex: Estou com dor de cabeca e febre ha 2 dias..."
                      className="min-h-[120px]"
                    />
                  </div>

                  {selectedSpecialty && !hasAvailableProfessionals && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      Nenhum profissional dessa especialidade esta com plantao ativo agora. Selecione outra especialidade para entrar na fila.
                    </div>
                  )}

                  {selectedSpecialty && queueStats && hasAvailableProfessionals && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-center gap-2 text-amber-700">
                        <Clock className="h-5 w-5" />
                        <span className="font-medium">
                          Tempo estimado de espera: ~{queueStats.estimatedWait || 10} minutos
                        </span>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleJoinQueue}
                    disabled={!selectedSpecialty || !hasAvailableProfessionals || enterQueue.isPending}
                    className="gradient-primary h-14 w-full border-0 text-lg text-white"
                  >
                    {enterQueue.isPending ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <Users className="mr-2 h-5 w-5" />
                    )}
                    Entrar na Fila
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 'queue' && queueEntry && (
            <motion.div key="queue" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Card className="border-0 shadow-md">
                <CardContent className="p-8 text-center">
                  <div className="relative mx-auto mb-6 h-32 w-32">
                    <div className="absolute inset-0 rounded-full border-4 border-emerald-100" />
                    <div className="absolute inset-0 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
                    <div className="absolute inset-4 flex items-center justify-center rounded-full bg-emerald-50">
                      <span className="text-4xl font-bold text-emerald-600">
                        {queueEntry.position || 1}
                      </span>
                    </div>
                  </div>

                  <h2 className="mb-2 text-2xl font-bold text-gray-900">Voce esta na fila</h2>
                  <p className="mb-6 text-gray-600">
                    Posicao {queueEntry.position} - Tempo estimado: ~{queueEntry.estimated_wait_time || 10} min
                  </p>

                  <div className="mb-6 rounded-xl bg-gray-50 p-4">
                    <div className="flex items-center justify-center gap-3 text-gray-600">
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                      <span className="text-sm">
                        Mantenha esta pagina aberta. Voce sera redirecionado automaticamente.
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => leaveQueue.mutate(queueEntry.id)}
                    disabled={leaveQueue.isPending}
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    {leaveQueue.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sair da Fila
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <Clock className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
              <p className="font-medium text-gray-900">Atendimento 24h</p>
              <p className="text-sm text-gray-500">Todos os dias</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <Stethoscope className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
              <p className="font-medium text-gray-900">Medicos Verificados</p>
              <p className="text-sm text-gray-500">CRM ativo</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <Video className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
              <p className="font-medium text-gray-900">Teleconsulta</p>
              <p className="text-sm text-gray-500">Video em HD</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ConsultaAgora() {
  return (
    <ProtectedRoute>
      <ConsultaAgoraInner />
    </ProtectedRoute>
  );
}
