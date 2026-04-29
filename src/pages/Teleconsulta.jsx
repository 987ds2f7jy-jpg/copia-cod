import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertCircle,
  ChevronLeft,
  Clock,
  FileText,
  History,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
} from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import {
  finishConsultaRequest,
  getTeleconsultaContextRequest,
  startConsultaSessionRequest,
} from '@/client-api/teleconsulta';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProntuarioForm from '@/components/teleconsulta/ProntuarioForm';
import ProntuariosAnteriores from '@/components/teleconsulta/ProntuariosAnteriores';
import AvaliacaoModal from '@/components/teleconsulta/AvaliacaoModal';
import PreenchimentoAutomaticoProntuario from '@/components/teleconsulta/PreenchimentoAutomaticoProntuario';
import ZoomChatPanel from '@/components/teleconsulta/ZoomChatPanel';
import ZoomVideoStage from '@/components/teleconsulta/ZoomVideoStage';
import { buildZoomDisplayName } from '@/lib/zoom';
import { useZoomSession } from '@/hooks/useZoomSession';

function getDashboardPath(role) {
  return role === 'professional' ? '/DashboardProfissional' : '/DashboardPaciente';
}

function renderConsultationStatus(status) {
  if (status === 'em_atendimento') {
    return 'Em andamento';
  }

  if (status === 'aguardando') {
    return 'Aguardando';
  }

  if (status === 'finalizada') {
    return 'Finalizada';
  }

  if (status === 'cancelada') {
    return 'Cancelada';
  }

  return status || 'Consulta';
}

function TeleconsultaInner({ consultationId }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [showProntuariosAnt, setShowProntuariosAnt] = useState(false);
  const [showAvaliacao, setShowAvaliacao] = useState(false);
  const [isLeavingSession, setIsLeavingSession] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState('chat');
  const [pendingProntuarioAutoFill, setPendingProntuarioAutoFill] = useState(null);
  const [prontuarioMode, setProntuarioMode] = useState('simples');

  const autoJoinAttemptRef = useRef(false);
  const autoStartAttemptRef = useRef(false);
  const evaluationPromptedRef = useRef(false);
  const lastConsultaStatusRef = useRef(null);

  const teleconsultaQuery = useQuery({
    queryKey: ['teleconsulta-context', consultationId],
    queryFn: () => getTeleconsultaContextRequest({
      consultationId,
      historyLimit: 20,
    }),
    enabled: Boolean(consultationId && user?.id && !isLeavingSession),
    refetchInterval: (query) => {
      const status = query.state.data?.consultation?.status;

      if (isLeavingSession || ['finalizada', 'cancelada'].includes(status)) {
        return false;
      }

      return 5000;
    },
  });

  const consulta = teleconsultaQuery.data?.consultation || null;
  const participant = teleconsultaQuery.data?.participant || null;
  const currentProntuario = teleconsultaQuery.data?.currentProntuario || null;
  const currentEvaluation = teleconsultaQuery.data?.currentEvaluation || null;
  const isProntuarioReady = Boolean(
    String(currentProntuario?.motivoConsulta || currentProntuario?.motivo_consulta || '').trim() &&
    String(currentProntuario?.recomendacoes || '').trim(),
  );

  const isParticipant = Boolean(participant?.isParticipant);
  const isProfissional = participant?.role === 'professional';
  const isPaciente = participant?.role === 'patient';
  const participantRole = isProfissional ? 'professional' : 'patient';

  const zoomDisplayName = useMemo(
    () => buildZoomDisplayName({ user, participantRole, consulta }),
    [consulta, participantRole, user],
  );

  const zoomSession = useZoomSession({
    consultationId: consultationId || '',
    participantRole,
    userId: user?.id || '',
    userName: zoomDisplayName,
  });

  const refreshContext = async () => {
    await queryClient.invalidateQueries({ queryKey: ['teleconsulta-context', consultationId] });
  };

  const refreshActiveConsultation = async () => {
    if (!user?.id) {
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['myActiveConsultation', user.id] });
  };

  const refreshDashboardQueries = async () => {
    if (!user?.id) {
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['patientAppointments', user.id] }),
      queryClient.invalidateQueries({ queryKey: ['patientReviews', user.id] }),
      queryClient.invalidateQueries({ queryKey: ['profAppts'] }),
      queryClient.invalidateQueries({ queryKey: ['myProfessionalProfile', user.id] }),
      queryClient.invalidateQueries({ queryKey: ['myPublicProfile'] }),
    ]);
  };

  const startConsulta = useMutation({
    mutationFn: () => startConsultaSessionRequest({ consultationId }),
    onSuccess: async () => {
      await refreshContext();
    },
    onError: (error) => {
      autoStartAttemptRef.current = false;
      toast({
        title: 'Falha ao preparar a consulta',
        description: error?.message || 'Nao foi possivel iniciar a sessao da teleconsulta.',
        variant: 'destructive',
      });
    },
  });

  const finishConsulta = useMutation({
    mutationFn: () => finishConsultaRequest({ consultationId }),
    onSuccess: async () => {
      await refreshContext();
      await refreshActiveConsultation();
      await refreshDashboardQueries();
      toast({
        title: 'Consulta finalizada com sucesso.',
      });
    },
    onError: (error) => {
      if (['PRONTUARIO_REQUIRED', 'PRONTUARIO_REQUIRED_FIELDS_MISSING'].includes(error?.code)) {
        setActiveSidebarTab('prontuario');
        toast({
          title: 'Preencha o prontuario antes de encerrar',
          description: error?.message || 'Revise, salve o prontuario e tente finalizar novamente.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Falha ao finalizar a consulta',
        description: error?.message || 'Nao foi possivel finalizar a consulta.',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    autoJoinAttemptRef.current = false;
    autoStartAttemptRef.current = false;
    evaluationPromptedRef.current = false;
    lastConsultaStatusRef.current = null;
    setShowAvaliacao(false);
    setActiveSidebarTab('chat');
    setPendingProntuarioAutoFill(null);
    setProntuarioMode('simples');
  }, [consultationId]);

  const queueProntuarioAutoFill = (fields) => {
    setProntuarioMode('completo');
    setPendingProntuarioAutoFill({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fields,
    });
    setActiveSidebarTab('prontuario');
  };

  useEffect(() => {
    if (!isProfissional) {
      return;
    }

    setProntuarioMode(currentProntuario?.mode || currentProntuario?.modo || 'simples');
  }, [
    currentProntuario?.id,
    currentProntuario?.mode,
    currentProntuario?.modo,
    currentProntuario?.updatedAt,
    currentProntuario?.updated_at,
    isProfissional,
  ]);

  useEffect(() => {
    if (!consulta?.status) {
      return;
    }

    const previousStatus = lastConsultaStatusRef.current;
    lastConsultaStatusRef.current = consulta.status;

    if (!['finalizada', 'cancelada'].includes(consulta.status)) {
      return;
    }

    autoJoinAttemptRef.current = true;
    void zoomSession.leave();

    if (
      isPaciente &&
      consulta.status === 'finalizada' &&
      !currentEvaluation &&
      !evaluationPromptedRef.current
    ) {
      evaluationPromptedRef.current = true;
      setShowAvaliacao(true);
    }

    if (previousStatus && previousStatus !== consulta.status) {
      toast({
        title: consulta.status === 'finalizada' ? 'Consulta encerrada.' : 'Consulta cancelada.',
      });
    }
  }, [consulta?.status, currentEvaluation, isPaciente, zoomSession.leave]);

  useEffect(() => {
    if (!['finalizada', 'cancelada'].includes(consulta?.status)) {
      return;
    }

    void queryClient.cancelQueries({ queryKey: ['teleconsulta-context', consultationId] });
  }, [consulta?.status, consultationId, queryClient]);

  useEffect(() => {
    if (typeof window === 'undefined' || !consulta?.id || !isParticipant) {
      return;
    }

    if (['finalizada', 'cancelada'].includes(consulta.status)) {
      window.sessionStorage.removeItem('rd_last_active_consultation');
      return;
    }

    window.sessionStorage.setItem('rd_last_active_consultation', consulta.id);
  }, [consulta?.id, consulta?.status, isParticipant]);

  useEffect(() => {
    if (!user?.id || !['finalizada', 'cancelada'].includes(consulta?.status)) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ['myActiveConsultation', user.id] });
  }, [consulta?.status, queryClient, user?.id]);

  const isZoomRoomReady = Boolean(
    consulta &&
    consulta.status === 'em_atendimento' &&
    consulta.roomId &&
    consulta.roomToken &&
    consulta.startedAt,
  );

  const needsSessionInitialization = Boolean(
    consulta &&
    participant?.canStartSession &&
    consulta.status !== 'finalizada' &&
    consulta.status !== 'cancelada' &&
    !isZoomRoomReady
  );

  useEffect(() => {
    if (!needsSessionInitialization || startConsulta.isPending || autoStartAttemptRef.current) {
      return;
    }

    autoStartAttemptRef.current = true;
    startConsulta.mutate();
  }, [needsSessionInitialization, startConsulta]);

  const canJoinZoom = Boolean(
    consulta &&
    isParticipant &&
    isZoomRoomReady &&
    consulta.status !== 'finalizada' &&
    consulta.status !== 'cancelada' &&
    !isLeavingSession &&
    !startConsulta.isPending &&
    !needsSessionInitialization
  );

  useEffect(() => {
    if (
      !canJoinZoom ||
      zoomSession.isConnected ||
      zoomSession.isConnecting ||
      autoJoinAttemptRef.current
    ) {
      return;
    }

    autoJoinAttemptRef.current = true;
    void zoomSession.join();
  }, [canJoinZoom, zoomSession.isConnected, zoomSession.isConnecting, zoomSession.join]);

  const retryZoomJoin = async () => {
    try {
      if (needsSessionInitialization && participant?.canStartSession) {
        autoStartAttemptRef.current = false;
        await startConsulta.mutateAsync();
      }

      autoJoinAttemptRef.current = false;
      await zoomSession.leave();
      await zoomSession.join();
    } catch {
      // Mutation toasts already surface the error.
    }
  };

  const leaveConsulta = async () => {
    if (!consulta || isLeavingSession) {
      return;
    }

    setIsLeavingSession(true);

    try {
      if (
        isProfissional &&
        participant?.canFinishSession &&
        !['finalizada', 'cancelada'].includes(consulta.status)
      ) {
        if (!isProntuarioReady) {
          setActiveSidebarTab('prontuario');
          toast({
            title: 'Prontuario obrigatorio para finalizar',
            description: 'Preencha motivo da consulta e recomendacoes, salve o prontuario e tente novamente.',
            variant: 'destructive',
          });
          return;
        }

        await finishConsulta.mutateAsync();
      }

      await queryClient.cancelQueries({ queryKey: ['teleconsulta-context', consultationId] });
      await refreshActiveConsultation();
      await refreshDashboardQueries();
      await zoomSession.leave();
      navigate(getDashboardPath(participant?.role));
    } catch {
      // Errors are already handled by the mutations or the hook.
    } finally {
      setIsLeavingSession(false);
    }
  };

  if (teleconsultaQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-white" />
      </div>
    );
  }

  if (!consulta) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center text-foreground dark:bg-gray-900 dark:text-white">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-lg">{teleconsultaQuery.error?.message || 'Consulta nao encontrada'}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Voltar
        </Button>
      </div>
    );
  }

  if (!isParticipant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center text-foreground dark:bg-gray-900 dark:text-white">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <h2 className="text-xl font-bold">Acesso restrito</h2>
        <p className="max-w-md text-muted-foreground dark:text-gray-400">
          Apenas paciente e profissional vinculados a esta consulta podem acessar esta teleconsulta.
        </p>
        <Button variant="outline" onClick={() => navigate('/')}>
          Voltar
        </Button>
      </div>
    );
  }

  if (consulta.status === 'finalizada') {
    const shouldShowEvaluation = isPaciente && showAvaliacao && !currentEvaluation;

    return (
      <>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center text-foreground dark:bg-gray-900 dark:text-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
            <Video className="h-8 w-8 text-emerald-400" />
          </div>

          <h2 className="text-xl font-bold">Consulta encerrada</h2>
          <p className="text-muted-foreground dark:text-gray-400">
            Duracao: {consulta.durationMinutes != null ? `${consulta.durationMinutes} min` : '-'}
          </p>

          {!shouldShowEvaluation && (
            <Button
              onClick={() => navigate(getDashboardPath(participant?.role))}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Voltar ao inicio
            </Button>
          )}
        </div>

        <AvaliacaoModal
          open={shouldShowEvaluation}
          consultationId={consulta.id}
          professionalName={consulta.professionalName}
          existingEvaluation={currentEvaluation}
          canSubmit={Boolean(participant?.canSubmitEvaluation)}
          onSubmitted={() => {
            setShowAvaliacao(false);
            navigate('/DashboardPaciente');
          }}
          onClose={() => {
            setShowAvaliacao(false);
            navigate('/DashboardPaciente');
          }}
        />
      </>
    );
  }

  const nomeOutro = isProfissional ? consulta.patientName : consulta.professionalName;
  const tipoLabels = {
    padrao: 'Por Especialidade',
    prioritario: 'Prioritaria',
    especialidade: 'Por Especialidade',
    plantao: 'Plantao',
  };

  return (
    <>
      <div className="flex min-h-screen flex-col bg-background dark:bg-gray-950">
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-white"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <div>
              <p className="text-sm font-medium text-foreground dark:text-white">{nomeOutro || 'Consulta'}</p>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/20 text-xs text-emerald-400">
                  {tipoLabels[consulta.consultationType] || consulta.consultationType || 'Teleconsulta'}
                </Badge>

                {consulta.startedAt && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground dark:text-gray-400">
                    <Clock className="h-3 w-3" />
                    {format(new Date(consulta.startedAt), 'HH:mm', { locale: ptBR })}
                  </span>
                )}

                {zoomSession.sessionName && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground dark:bg-gray-800 dark:text-gray-400">
                    Sala segura
                  </span>
                )}
              </div>
            </div>
          </div>

          <Badge className={consulta.status === 'em_atendimento' ? 'animate-pulse bg-green-500/20 text-green-500 dark:text-green-400' : 'bg-muted text-muted-foreground dark:bg-gray-700 dark:text-gray-300'}>
            {renderConsultationStatus(consulta.status)}
          </Badge>
        </div>

        <div className="relative flex flex-1 flex-col overflow-hidden lg:flex-row">
          <div className="relative z-0 flex min-h-[360px] min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4 pb-5 lg:min-h-0">
            {(needsSessionInitialization || startConsulta.isPending) && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                {startConsulta.isPending
                  ? 'Preparando a sala segura e registrando o inicio da consulta...'
                  : 'Inicializando a sessao clinica segura no backend...'}
              </div>
            )}

            {isPaciente && !isZoomRoomReady && !startConsulta.isPending && (
              <div className="rounded-xl border border-sky-500/30 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100">
                Aguardando o profissional iniciar a sala segura para liberar a videochamada.
              </div>
            )}

            {zoomSession.error && (
              <div className="rounded-xl border border-red-500/30 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Falha ao conectar a videochamada</p>
                    <p className="mt-1 text-red-600/80 dark:text-red-200/80">{zoomSession.error}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-300/50 text-red-700 hover:bg-red-500/10 dark:border-red-300/20 dark:text-white"
                    onClick={() => void retryZoomJoin()}
                  >
                    Tentar novamente
                  </Button>
                </div>
              </div>
            )}

            <div className="relative z-0 min-h-[42vh] flex-1 overflow-hidden lg:min-h-0">
              <ZoomVideoStage
                participants={zoomSession.participants}
                currentUserId={zoomSession.currentUserId}
                isConnecting={zoomSession.isConnecting || startConsulta.isPending}
                isConnected={zoomSession.isConnected}
                registerVideoContainer={zoomSession.registerVideoContainer}
                selfLabel="Voce"
                remoteLabel={isProfissional ? consulta.patientName : `Dr(a). ${consulta.professionalName}`}
                allowInsetSelfView={!zoomSession.prefersSingleVideoLayout}
              />
            </div>

            <div className="flex items-center justify-center gap-3 pb-[env(safe-area-inset-bottom)]">
              <Button
                variant="outline"
                size="icon"
                className={`h-12 w-12 rounded-full border-gray-700 ${
                  !zoomSession.isMuted ? 'bg-gray-800 text-white' : 'border-red-600 bg-red-600 text-white'
                }`}
                onClick={() => void zoomSession.toggleMute()}
                disabled={!zoomSession.isConnected}
              >
                {!zoomSession.isMuted ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </Button>

              <Button
                variant="outline"
                size="icon"
                className={`h-12 w-12 rounded-full border-gray-700 ${
                  zoomSession.isCameraOn ? 'bg-gray-800 text-white' : 'border-red-600 bg-red-600 text-white'
                }`}
                onClick={() => void zoomSession.toggleCamera()}
                disabled={!zoomSession.isConnected}
              >
                {zoomSession.isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>

              <Button
                size="icon"
                className="h-14 w-14 rounded-full bg-red-600 text-white hover:bg-red-700"
                onClick={() => void leaveConsulta()}
                disabled={isLeavingSession || finishConsulta.isPending}
              >
                {isLeavingSession || finishConsulta.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <PhoneOff className="h-6 w-6" />
                )}
              </Button>
            </div>
          </div>

          <div className="relative z-10 isolate flex h-[36vh] min-h-[260px] min-w-0 max-h-[360px] flex-col border-t border-border bg-card lg:h-auto lg:max-h-none lg:w-96 lg:border-l lg:border-t-0 dark:border-gray-800 dark:bg-gray-900">
            <Tabs value={activeSidebarTab} onValueChange={setActiveSidebarTab} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              <TabsList className="m-2 shrink-0 rounded-lg bg-muted dark:bg-gray-800">
                <TabsTrigger value="chat" className="flex-1 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground dark:text-gray-300 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white">
                  <MessageSquare className="mr-1 h-4 w-4" />
                  Chat
                </TabsTrigger>

                {isProfissional && (
                  <TabsTrigger value="prontuario" className="flex-1 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground dark:text-gray-300 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white">
                    <FileText className="mr-1 h-4 w-4" />
                    Prontuario
                  </TabsTrigger>
                )}
              </TabsList>

              {activeSidebarTab === 'chat' && (
                <div className="min-h-0 flex-1">
                  <ZoomChatPanel
                    messages={zoomSession.chatMessages}
                    onSend={zoomSession.sendChatMessage}
                    disabled={!zoomSession.isConnected}
                  />
                </div>
              )}

              {isProfissional && activeSidebarTab === 'prontuario' && (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="relative z-10 shrink-0 border-b border-border bg-card px-3 py-3 dark:border-gray-800 dark:bg-gray-900">
                    <div className="space-y-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-border text-xs text-muted-foreground hover:bg-muted dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        onClick={() => setShowProntuariosAnt(true)}
                      >
                        <History className="mr-1 h-3.5 w-3.5" />
                        Prontuarios anteriores
                      </Button>

                      {consulta.symptoms && (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                          <p className="mb-1 text-xs font-medium text-amber-700 dark:text-amber-400">Sintomas do paciente</p>
                          <p className="text-xs text-foreground dark:text-gray-300">{consulta.symptoms}</p>
                        </div>
                      )}

                      {prontuarioMode === 'completo' && (
                        <PreenchimentoAutomaticoProntuario
                          consultationId={consulta.id}
                          disabled={!Boolean(participant?.canUpsertProntuario)}
                          onApply={queueProntuarioAutoFill}
                        />
                      )}
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <div className="p-3">
                      <ProntuarioForm
                        consultationId={consulta.id}
                        initialProntuario={currentProntuario}
                        canEdit={Boolean(participant?.canUpsertProntuario)}
                        showAutomaticFill={false}
                        defaultMode="simples"
                        mode={prontuarioMode}
                        onModeChange={setProntuarioMode}
                        externalAutoFill={pendingProntuarioAutoFill}
                      />
                    </div>
                  </div>
                </div>
              )}
            </Tabs>
          </div>
        </div>
      </div>

      {isProfissional && (
        <ProntuariosAnteriores
          open={showProntuariosAnt}
          onClose={() => setShowProntuariosAnt(false)}
          patientId={consulta.patientId}
          excludeConsultationId={consulta.id}
        />
      )}

      <AvaliacaoModal
        open={showAvaliacao && isPaciente}
        consultationId={consulta.id}
        professionalName={consulta.professionalName}
        existingEvaluation={currentEvaluation}
        canSubmit={Boolean(participant?.canSubmitEvaluation)}
        onSubmitted={() => {
          setShowAvaliacao(false);
          navigate('/DashboardPaciente');
        }}
        onClose={() => {
          setShowAvaliacao(false);
          navigate('/DashboardPaciente');
        }}
      />
    </>
  );
}

export default function Teleconsulta() {
  const { consultaId } = useParams();
  const queryParamId = new URLSearchParams(window.location.search).get('id');

  return <TeleconsultaInner consultationId={consultaId || queryParamId || ''} />;
}
