import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/components/AuthContext';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Clock, Users, Stethoscope, Loader2, AlertCircle, Video } from 'lucide-react';
import { canWorkOnDuty, isProfessionalApprovedStatus } from '@/lib/professionals';

const specialties = [
  { id: 'clinico_geral', name: 'ClÃ­nico Geral' },
  { id: 'pediatria', name: 'Pediatria' },
  { id: 'psicologia', name: 'Psicologia' },
  { id: 'psiquiatria', name: 'Psiquiatria' },
];

function ConsultaAgoraInner() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState('form');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [queueEntry, setQueueEntry] = useState(null);

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

  // Restore + redirecionamento imediato se jÃ¡ estava na fila
  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    const checkActive = async () => {
      const [waiting, inProg, inAttendance] = await Promise.all([
        base44.entities.Queue.filter({ patient_id: user.id, status: 'waiting' }),
        base44.entities.Queue.filter({ patient_id: user.id, status: 'in_progress' }),
        base44.entities.Queue.filter({ patient_id: user.id, status: 'em_atendimento' }),
      ]);
      if (!active) return;
      const activeQueueEntries = [...inProg, ...inAttendance];

      if (waiting.length > 0) {
        setQueueEntry(waiting[0]);
        setStep('queue');
      } else if (activeQueueEntries.length > 0) {
        const activeConsulta = await findActivePlantaoConsulta(user.id);
        if (activeConsulta) {
          navigate(`/consulta/${activeConsulta.id}`);
        } else {
          setQueueEntry(activeQueueEntries[0]);
          setStep('queue');
        }
      }
    };

    checkActive();
    return () => { active = false; };
  }, [user?.id, navigate]);

  // Contador de mÃ©dicos em plantÃ£o (busca nas duas entidades)
  const { data: onDutyProfessionals = [] } = useQuery({
    queryKey: ['onDutyProfessionals'],
    queryFn: async () => {
      const [profiles, publicProfiles] = await Promise.all([
        base44.entities.ProfessionalProfile.filter({ is_on_duty: true }),
        base44.entities.ProfessionalPublicProfile.filter({ is_on_duty: true }),
      ]);
      return [...profiles, ...publicProfiles].filter((profile) => isProfessionalApprovedStatus(profile.status));
    },
    refetchInterval: 8000,
  });

  const medicosDisponiveis = onDutyProfessionals.filter(p =>
    canWorkOnDuty(p.specialty)
  ).length;

  const { data: queueStats } = useQuery({
    queryKey: ['queueStats', selectedSpecialty],
    queryFn: async () => {
      const filters = { status: 'waiting' };
      if (selectedSpecialty) filters.specialty = selectedSpecialty;
      const queue = await base44.entities.Queue.filter(filters);
      return { count: queue.length, estimatedWait: queue.length * 10 };
    },
    refetchInterval: 30000,
  });

  const enterQueue = useMutation({
    mutationFn: async (data) => {
      const [waiting, inProgress, inAttendance] = await Promise.all([
        base44.entities.Queue.filter({ patient_id: data.patient_id, status: 'waiting' }),
        base44.entities.Queue.filter({ patient_id: data.patient_id, status: 'in_progress' }),
        base44.entities.Queue.filter({ patient_id: data.patient_id, status: 'em_atendimento' }),
      ]);
      if (waiting.length > 0) return waiting[0];
      if (inProgress.length > 0) return inProgress[0];
      if (inAttendance.length > 0) return inAttendance[0];
      const position = (queueStats?.count || 0) + 1;
      return base44.entities.Queue.create({ ...data, position, estimated_wait_time: position * 10 });
    },
    onSuccess: (data) => {
      setQueueEntry(data);
      setStep('queue');
      queryClient.invalidateQueries({ queryKey: ['queueStats'] });
    },
  });

  const leaveQueue = useMutation({
    mutationFn: (id) => base44.entities.Queue.update(id, { status: 'cancelled' }),
    onSuccess: () => {
      setQueueEntry(null);
      setStep('form');
      queryClient.invalidateQueries({ queryKey: ['queueStats'] });
    },
  });

  // Subscribe â€” redireciona imediatamente quando profissional aceitar
  useEffect(() => {
    if (!queueEntry?.id) return;

    const unsubscribe = base44.entities.Queue.subscribe((event) => {
      if (event.id === queueEntry.id && event.type === 'update') {
        setQueueEntry(event.data);
        if (['in_progress', 'em_atendimento'].includes(event.data.status)) {
          findActivePlantaoConsulta(user.id).then((activeConsulta) => {
            if (activeConsulta) {
              navigate(`/consulta/${activeConsulta.id}`);
            }
          });
        }
      }
    });

    return () => unsubscribe();
  }, [queueEntry?.id, user?.id, navigate]);

  useEffect(() => {
    if (!user?.id || !queueEntry || !['in_progress', 'em_atendimento'].includes(queueEntry.status)) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      const activeConsulta = await findActivePlantaoConsulta(user.id);

      if (activeConsulta) {
        window.clearInterval(intervalId);
        navigate(`/consulta/${activeConsulta.id}`);
      }
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, [queueEntry?.id, queueEntry?.status, user?.id, navigate]);

  const handleJoinQueue = () => {
    if (!user || !selectedSpecialty) return;
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 rounded-full text-emerald-700 text-sm font-medium mb-4">
            <Clock className="w-4 h-4" />
            Atendimento Imediato
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Consulta Agora</h1>
          <p className="text-gray-600">Conecte-se com um mÃ©dico disponÃ­vel em minutos</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'form' && (
            <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              {/* Contador de mÃ©dicos */}
              <Card className="border-0 shadow-sm mb-6">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Stethoscope className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{medicosDisponiveis} mÃ©dicos disponÃ­veis</p>
                        <p className="text-sm text-gray-500">Prontos para atendimento</p>
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

              {/* FormulÃ¡rio */}
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
                        {specialties.map(spec => (
                          <SelectItem key={spec.id} value={spec.id}>{spec.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="mb-2 block">Descreva seus sintomas</Label>
                    <Textarea
                      value={symptoms}
                      onChange={e => setSymptoms(e.target.value)}
                      placeholder="Ex: Estou com dor de cabeÃ§a e febre hÃ¡ 2 dias..."
                      className="min-h-[120px]"
                    />
                  </div>

                  {selectedSpecialty && queueStats && (
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <div className="flex items-center gap-2 text-amber-700">
                        <Clock className="w-5 h-5" />
                        <span className="font-medium">
                          Tempo estimado de espera: ~{queueStats.estimatedWait || 10} minutos
                        </span>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleJoinQueue}
                    disabled={!selectedSpecialty || enterQueue.isPending}
                    className="w-full h-14 gradient-primary border-0 text-white text-lg"
                  >
                    {enterQueue.isPending
                      ? <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      : <Users className="w-5 h-5 mr-2" />
                    }
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
                  <div className="relative w-32 h-32 mx-auto mb-6">
                    <div className="absolute inset-0 rounded-full border-4 border-emerald-100" />
                    <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
                    <div className="absolute inset-4 rounded-full bg-emerald-50 flex items-center justify-center">
                      <span className="text-4xl font-bold text-emerald-600">
                        {queueEntry.position || 1}
                      </span>
                    </div>
                  </div>

                  <h2 className="text-2xl font-bold text-gray-900 mb-2">VocÃª estÃ¡ na fila</h2>
                  <p className="text-gray-600 mb-6">
                    PosiÃ§Ã£o {queueEntry.position} â€¢ Tempo estimado: ~{queueEntry.estimated_wait_time || 10} min
                  </p>

                  <div className="p-4 bg-gray-50 rounded-xl mb-6">
                    <div className="flex items-center gap-3 justify-center text-gray-600">
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                      <span className="text-sm">
                        Mantenha esta pÃ¡gina aberta. VocÃª serÃ¡ redirecionado automaticamente.
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => leaveQueue.mutate(queueEntry.id)}
                    disabled={leaveQueue.isPending}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    {leaveQueue.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Sair da Fila
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info Cards */}
        <div className="grid sm:grid-cols-3 gap-4 mt-8">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <Clock className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="font-medium text-gray-900">Atendimento 24h</p>
              <p className="text-sm text-gray-500">Todos os dias</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <Stethoscope className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="font-medium text-gray-900">MÃ©dicos Verificados</p>
              <p className="text-sm text-gray-500">CRM ativo</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <Video className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="font-medium text-gray-900">Teleconsulta</p>
              <p className="text-sm text-gray-500">VÃ­deo em HD</p>
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
