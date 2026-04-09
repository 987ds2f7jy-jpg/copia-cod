import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProntuarioForm from '@/components/teleconsulta/ProntuarioForm';
import ProntuariosAnteriores from '@/components/teleconsulta/ProntuariosAnteriores';
import AvaliacaoModal from '@/components/teleconsulta/AvaliacaoModal';
import ZoomChatPanel from '@/components/teleconsulta/ZoomChatPanel';
import ZoomVideoStage from '@/components/teleconsulta/ZoomVideoStage';
import { getConsultaParticipantIds, isConsultaParticipant } from '@/lib/consultas';
import { logUiWarning } from '@/lib/observability';
import { buildZoomDisplayName } from '@/lib/zoom';
import { useZoomSession } from '@/hooks/useZoomSession';

function TeleconsultaInner({ consultaId }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showProntuariosAnt, setShowProntuariosAnt] = useState(false);
  const [showAvaliacao, setShowAvaliacao] = useState(false);
  const [isLeavingSession, setIsLeavingSession] = useState(false);
  const autoJoinAttemptRef = useRef(false);
  const evaluationPromptedRef = useRef(false);
  const lastConsultaStatusRef = useRef(null);

  const { data: consulta, isLoading } = useQuery({
    queryKey: ['consulta', consultaId],
    queryFn: () => base44.entities.Consulta.get(consultaId),
    enabled: !!consultaId && !!user?.id,
    refetchInterval: 5000,
  });

  const { data: currentProfessionalProfile, isLoading: isLoadingProfessionalIdentity } = useQuery({
    queryKey: ['teleconsulta-professional-identity', user?.id],
    queryFn: async () => {
      const [profiles, legacyProfiles] = await Promise.all([
        base44.entities.ProfessionalProfile.filter({ user_id: user.id }, undefined, 1),
        base44.entities.Professional.filter({ user_id: user.id }, undefined, 1),
      ]);

      return profiles?.[0] || legacyProfiles?.[0] || null;
    },
    enabled: !!user?.id && user?.role === 'professional',
    staleTime: 60_000,
  });

  const participantIds = useMemo(
    () => [
      user?.id,
      currentProfessionalProfile?.id,
      currentProfessionalProfile?.user_id,
    ].filter(Boolean),
    [currentProfessionalProfile?.id, currentProfessionalProfile?.user_id, user?.id],
  );

  const isProfissional = Boolean(
    consulta &&
    user?.role === 'professional' &&
    isConsultaParticipant(consulta, participantIds)
  );
  const isPaciente = Boolean(consulta && user && consulta.paciente_id === user.id);
  const isParticipant = isConsultaParticipant(consulta, participantIds);
  const participantRole = isProfissional ? 'professional' : 'patient';
  const zoomDisplayName = useMemo(
    () => buildZoomDisplayName({ user, participantRole, consulta }),
    [consulta, participantRole, user],
  );

  const zoomSession = useZoomSession({
    consultationId: consultaId,
    participantRole,
    userId: user?.id || '',
    userName: zoomDisplayName,
  });

  useEffect(() => {
    autoJoinAttemptRef.current = false;
    evaluationPromptedRef.current = false;
    lastConsultaStatusRef.current = null;
    setShowAvaliacao(false);
  }, [consultaId]);

  useEffect(() => {
    if (!consulta?.status) {
      return;
    }

    const previousStatus = lastConsultaStatusRef.current;
    lastConsultaStatusRef.current = consulta.status;

    if (previousStatus === consulta.status) {
      return;
    }

    if (!['finalizada', 'cancelada'].includes(consulta.status)) {
      return;
    }

    autoJoinAttemptRef.current = true;
    void zoomSession.leave();

    if (
      isPaciente &&
      consulta.status === 'finalizada' &&
      previousStatus &&
      previousStatus !== 'finalizada' &&
      !evaluationPromptedRef.current
    ) {
      evaluationPromptedRef.current = true;
      setShowAvaliacao(true);
    }
  }, [consulta?.status, isPaciente, zoomSession.leave]);

  const needsSessionInitialization = Boolean(
    consulta &&
    isParticipant &&
    consulta.status !== 'finalizada' &&
    (
      consulta.status === 'aguardando' ||
      !consulta.sala_id ||
      !consulta.token_sala ||
      !consulta.inicio_at
    )
  );

  useEffect(() => {
    if (
      !consulta ||
      !user?.id ||
      isParticipant ||
      (user?.role === 'professional' && isLoadingProfessionalIdentity)
    ) {
      return;
    }

    logUiWarning('teleconsulta', {
      consultaId,
      userId: user.id,
      profissionalId: consulta.profissional_id,
      profissionalUserId: consulta.profissional_user_id || null,
      professionalProfileId: currentProfessionalProfile?.id || null,
      pacienteId: consulta.paciente_id,
      consultaParticipantIds: getConsultaParticipantIds(consulta),
      reason: 'unauthorized-access-attempt',
    });
  }, [
    consulta,
    consultaId,
    currentProfessionalProfile?.id,
    isLoadingProfessionalIdentity,
    isParticipant,
    user?.id,
    user?.role,
  ]);

  const canJoinZoom = Boolean(
    consulta &&
    isParticipant &&
    consulta.status !== 'finalizada' &&
    consulta.status !== 'cancelada' &&
    !isLeavingSession
  );

  useEffect(() => {
    if (!canJoinZoom || zoomSession.isConnected || zoomSession.isConnecting || autoJoinAttemptRef.current) {
      return;
    }

    autoJoinAttemptRef.current = true;
    void zoomSession.join();
  }, [canJoinZoom, zoomSession.isConnected, zoomSession.isConnecting, zoomSession.join]);

  const retryZoomJoin = async () => {
    autoJoinAttemptRef.current = false;
    await zoomSession.leave();
    await zoomSession.join();
  };

  const leaveConsultaWithoutWrite = async () => {
    autoJoinAttemptRef.current = true;
    setIsLeavingSession(true);

    try {
      await zoomSession.leave();
      toast({
        title: 'Fluxo pendente de backend',
        description: 'TODO: implementar Edge Function finish-consulta para encerrar a consulta sem escrita direta no frontend.',
        variant: 'destructive',
      });
      navigate(isPaciente ? '/DashboardPaciente' : '/DashboardProfissional');
    } finally {
      setIsLeavingSession(false);
    }
  };

  if (isLoading || (user?.role === 'professional' && isLoadingProfessionalIdentity)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (!consulta) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-900 text-white">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-lg">Consulta nao encontrada</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    );
  }

  if (!isParticipant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-900 px-4 text-center text-white">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <h2 className="text-xl font-bold">Acesso restrito</h2>
        <p className="max-w-md text-gray-400">
          Apenas paciente e profissional vinculados a esta consulta podem acessar esta teleconsulta.
        </p>
        <Button variant="outline" onClick={() => navigate('/')}>Voltar</Button>
      </div>
    );
  }

  if (consulta.status === 'finalizada') {
    const shouldShowEvaluation = isPaciente && showAvaliacao;

    return (
      <>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-900 px-4 text-center text-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
            <Video className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold">Consulta Encerrada</h2>
          <p className="text-gray-400">
            Duracao: {consulta.inicio_at && consulta.fim_at
              ? `${Math.round((new Date(consulta.fim_at) - new Date(consulta.inicio_at)) / 60000)} min`
              : '-'}
          </p>
          {!shouldShowEvaluation && (
            <Button
              onClick={() => navigate(isPaciente ? '/DashboardPaciente' : '/DashboardProfissional')}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Voltar ao Inicio
            </Button>
          )}
        </div>

        {shouldShowEvaluation && (
          <AvaliacaoModal
            open={showAvaliacao}
            consulta={consulta}
            pacienteId={user?.id}
            onClose={() => {
              setShowAvaliacao(false);
              navigate('/DashboardPaciente');
            }}
          />
        )}
      </>
    );
  }

  const nomeOutro = isProfissional ? consulta.paciente_nome : consulta.profissional_nome;
  const tipoLabels = {
    padrao: 'Por Especialidade',
    prioritario: 'Prioritaria',
    especialidade: 'Por Especialidade',
    plantao: 'Plantao',
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="border-b border-gray-800 bg-gray-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <p className="text-sm font-medium text-white">{nomeOutro || 'Consulta'}</p>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">
                {tipoLabels[consulta.tipo_consulta] || consulta.tipo_consulta}
              </Badge>
              {consulta.inicio_at && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="h-3 w-3" />
                  {format(new Date(consulta.inicio_at), 'HH:mm', { locale: ptBR })}
                </span>
              )}
              {zoomSession.sessionName && (
                <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[11px] text-gray-400">
                  Sala segura
                </span>
              )}
            </div>
          </div>
        </div>
        <Badge className={consulta.status === 'em_atendimento' ? 'bg-green-500/20 text-green-400 animate-pulse' : 'bg-gray-700 text-gray-300'}>
          {consulta.status === 'em_atendimento' ? 'Em andamento' : consulta.status}
        </Badge>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 flex flex-col gap-3 p-4 min-h-[320px] lg:min-h-0">
          {needsSessionInitialization && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              TODO backend: implementar `start-consulta-session` para iniciar a consulta e persistir o estado sem escrita direta no frontend.
            </div>
          )}

          {zoomSession.error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">Falha ao conectar a videochamada</p>
                  <p className="mt-1 text-red-200/80">{zoomSession.error}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300/20 text-white hover:bg-red-500/10"
                  onClick={() => void retryZoomJoin()}
                >
                  Tentar novamente
                </Button>
              </div>
            </div>
          )}

          <div className="flex-1 relative">
            <ZoomVideoStage
              participants={zoomSession.participants}
              currentUserId={zoomSession.currentUserId}
              isConnecting={zoomSession.isConnecting}
              isConnected={zoomSession.isConnected}
              registerVideoContainer={zoomSession.registerVideoContainer}
              selfLabel="Voce"
              remoteLabel={isProfissional ? consulta.paciente_nome : `Dr(a). ${consulta.profissional_nome}`}
            />
          </div>

          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className={`h-12 w-12 rounded-full border-gray-700 ${
                !zoomSession.isMuted ? 'bg-gray-800 text-white' : 'bg-red-600 text-white border-red-600'
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
                zoomSession.isCameraOn ? 'bg-gray-800 text-white' : 'bg-red-600 text-white border-red-600'
              }`}
              onClick={() => void zoomSession.toggleCamera()}
              disabled={!zoomSession.isConnected}
            >
              {zoomSession.isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
            <Button
              size="icon"
              className="h-14 w-14 rounded-full bg-red-600 text-white hover:bg-red-700"
              onClick={() => void leaveConsultaWithoutWrite()}
              disabled={isLeavingSession}
            >
              {isLeavingSession ? <Loader2 className="h-5 w-5 animate-spin" /> : <PhoneOff className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        <div className="flex flex-col border-t border-gray-800 bg-gray-900 lg:w-96 lg:border-l lg:border-t-0">
          <Tabs defaultValue="chat" className="flex flex-1 flex-col min-h-0">
            <TabsList className="m-2 shrink-0 rounded-lg bg-gray-800">
              <TabsTrigger value="chat" className="flex-1 text-gray-300 data-[state=active]:bg-gray-700 data-[state=active]:text-white">
                <MessageSquare className="mr-1 h-4 w-4" />Chat
              </TabsTrigger>
              {isProfissional && (
                <TabsTrigger value="prontuario" className="flex-1 text-gray-300 data-[state=active]:bg-gray-700 data-[state=active]:text-white">
                  <FileText className="mr-1 h-4 w-4" />Prontuario
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="chat" className="m-0 flex h-0 flex-1 flex-col overflow-hidden">
              <div className="flex-1 min-h-0">
                <ZoomChatPanel
                  messages={zoomSession.chatMessages}
                  onSend={zoomSession.sendChatMessage}
                  disabled={!zoomSession.isConnected}
                />
              </div>
            </TabsContent>

            {isProfissional && (
              <TabsContent value="prontuario" className="m-0 flex-1 overflow-y-auto p-3 min-h-0">
                <div className="mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-600 text-xs text-gray-300 hover:bg-gray-700"
                    onClick={() => setShowProntuariosAnt(true)}
                  >
                    <History className="mr-1 h-3.5 w-3.5" />
                    Prontuarios Anteriores
                  </Button>
                </div>

                {consulta.descricao_sintomas && (
                  <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                    <p className="mb-1 text-xs font-medium text-amber-400">Sintomas do paciente</p>
                    <p className="text-xs text-gray-300">{consulta.descricao_sintomas}</p>
                  </div>
                )}

                <ProntuarioForm
                  consultaId={consultaId}
                  pacienteId={consulta.paciente_id}
                  profissionalId={currentProfessionalProfile?.id || consulta.profissional_id}
                />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      {isProfissional && (
        <ProntuariosAnteriores
          open={showProntuariosAnt}
          onClose={() => setShowProntuariosAnt(false)}
          pacienteId={consulta?.paciente_id}
        />
      )}

      <AvaliacaoModal
        open={showAvaliacao}
        consulta={consulta}
        pacienteId={user?.id}
        onClose={() => {
          setShowAvaliacao(false);
          navigate('/DashboardPaciente');
        }}
      />
    </div>
  );
}

export default function Teleconsulta() {
  const { consultaId } = useParams();
  const queryParamId = new URLSearchParams(window.location.search).get('id');

  return <TeleconsultaInner consultaId={consultaId || queryParamId} />;
}
