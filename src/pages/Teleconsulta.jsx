import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/components/AuthContext';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Send, Loader2,
  FileText, MessageSquare, ChevronLeft, Clock, User,
  AlertCircle, History
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ProntuarioForm from '@/components/teleconsulta/ProntuarioForm';
import ProntuariosAnteriores from '@/components/teleconsulta/ProntuariosAnteriores';
import AvaliacaoModal from '@/components/teleconsulta/AvaliacaoModal';
import { isConsultaParticipant } from '@/lib/consultas';
import { logUiWarning } from '@/lib/observability';

function VideoPlaceholder({ nome, role }) {
  return (
    <div className="relative w-full h-full bg-gray-900 rounded-xl flex flex-col items-center justify-center select-none">
      <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center mb-3">
        <User className="w-10 h-10 text-gray-400" />
      </div>
      <p className="text-white text-sm font-medium">{nome || 'Participante'}</p>
      <p className="text-gray-400 text-xs mt-1">{role}</p>
      <div className="absolute top-3 left-3">
        <Badge className="bg-red-500 text-white text-xs animate-pulse">AO VIVO</Badge>
      </div>
    </div>
  );
}

function ChatPanel({ consultaId, userId, userName, userTipo }) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');
  const bottomRef = useRef(null);

  const { data: mensagens = [] } = useQuery({
    queryKey: ['mensagensConsulta', consultaId],
    queryFn: () => base44.entities.MensagemConsulta.filter({ consulta_id: consultaId }, 'created_date', 100),
    enabled: !!consultaId && !!userId,
    refetchInterval: 3000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens.length]);

  const enviar = useMutation({
    mutationFn: () => base44.entities.MensagemConsulta.create({
      consulta_id: consultaId,
      remetente_id: userId,
      remetente_nome: userName,
      remetente_tipo: userTipo,
      mensagem: texto.trim(),
    }),
    onSuccess: () => {
      setTexto('');
      queryClient.invalidateQueries({ queryKey: ['mensagensConsulta', consultaId] });
    },
  });

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (texto.trim()) {
        enviar.mutate();
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {mensagens.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-4">Nenhuma mensagem ainda</p>
        )}
        {mensagens.map((mensagem) => {
          const isMe = mensagem.remetente_id === userId;

          return (
            <div key={mensagem.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${isMe ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                {!isMe && <p className="text-xs font-medium mb-1 opacity-70">{mensagem.remetente_nome}</p>}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{mensagem.mensagem}</p>
                <p className={`text-xs mt-1 ${isMe ? 'text-emerald-200' : 'text-gray-400'}`}>
                  {mensagem.created_date ? format(new Date(mensagem.created_date), 'HH:mm') : ''}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-gray-100">
        <div className="flex gap-2">
          <Textarea
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem... (Enter para enviar)"
            className="resize-none text-sm min-h-[40px] max-h-24"
            rows={1}
          />
          <Button
            size="icon"
            className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 self-end"
            onClick={() => texto.trim() && enviar.mutate()}
            disabled={!texto.trim() || enviar.isPending}
          >
            {enviar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TeleconsultaInner({ consultaId }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [showProntuariosAnt, setShowProntuariosAnt] = useState(false);
  const [showAvaliacao, setShowAvaliacao] = useState(false);

  const { data: consulta, isLoading } = useQuery({
    queryKey: ['consulta', consultaId],
    queryFn: () => base44.entities.Consulta.get(consultaId),
    enabled: !!consultaId && !!user?.id,
    refetchInterval: 5000,
  });

  const isProfissional = Boolean(consulta && user && consulta.profissional_id === user.id);
  const isPaciente = Boolean(consulta && user && consulta.paciente_id === user.id);
  const isParticipant = isConsultaParticipant(consulta, user?.id);

  const iniciarConsulta = useMutation({
    mutationFn: () => base44.entities.Consulta.update(consultaId, {
      status: 'em_atendimento',
      inicio_at: new Date().toISOString(),
      sala_id: `sala-${consultaId.slice(0, 8)}`,
      token_sala: `tk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['consulta', consultaId] }),
  });

  useEffect(() => {
    if (consulta && consulta.status === 'aguardando' && isParticipant && !iniciarConsulta.isPending) {
      iniciarConsulta.mutate();
    }
  }, [consulta?.id, consulta?.status, isParticipant]);

  useEffect(() => {
    if (consulta && user?.id && !isParticipant) {
      logUiWarning('teleconsulta', {
        consultaId,
        userId: user.id,
        profissionalId: consulta.profissional_id,
        pacienteId: consulta.paciente_id,
        reason: 'unauthorized-access-attempt',
      });
    }
  }, [consulta?.id, isParticipant, user?.id, consultaId]);

  const encerrar = useMutation({
    mutationFn: () => base44.entities.Consulta.update(consultaId, {
      status: 'finalizada',
      fim_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      if (isPaciente) {
        setShowAvaliacao(true);
        return;
      }

      navigate('/DashboardProfissional');
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (!consulta) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white gap-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-lg">Consulta nao encontrada</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    );
  }

  if (!isParticipant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white gap-4 px-4 text-center">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <h2 className="text-xl font-bold">Acesso restrito</h2>
        <p className="text-gray-400 max-w-md">Apenas paciente e profissional vinculados a esta consulta podem acessar esta teleconsulta.</p>
        <Button variant="outline" onClick={() => navigate('/')}>Voltar</Button>
      </div>
    );
  }

  if (consulta.status === 'finalizada') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white gap-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Video className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold">Consulta Encerrada</h2>
        <p className="text-gray-400">
          Duracao: {consulta.inicio_at && consulta.fim_at
            ? `${Math.round((new Date(consulta.fim_at) - new Date(consulta.inicio_at)) / 60000)} min`
            : '—'}
        </p>
        <div className="flex gap-3">
          <Button onClick={() => navigate(isPaciente ? '/DashboardPaciente' : '/DashboardProfissional')} className="bg-emerald-600 hover:bg-emerald-700">
            Voltar ao Inicio
          </Button>
        </div>
      </div>
    );
  }

  const nomeOutro = isProfissional ? consulta.paciente_nome : consulta.profissional_nome;
  const userTipo = isProfissional ? 'profissional' : 'paciente';
  const tipoLabels = {
    padrao: 'Por Especialidade',
    prioritario: 'Prioritaria',
    especialidade: 'Por Especialidade',
    plantao: 'Plantao',
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <p className="text-white font-medium text-sm">{nomeOutro || 'Consulta'}</p>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">{tipoLabels[consulta.tipo_consulta] || consulta.tipo_consulta}</Badge>
              {consulta.inicio_at && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(consulta.inicio_at), 'HH:mm', { locale: ptBR })}
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
        <div className="flex-1 flex flex-col p-4 gap-3 min-h-[300px] lg:min-h-0">
          <div className="flex-1 relative">
            <VideoPlaceholder nome={nomeOutro} role={isProfissional ? 'Paciente' : `Dr(a). ${consulta.profissional_nome}`} />
            <div className="absolute bottom-3 right-3 w-28 h-20 rounded-lg overflow-hidden border-2 border-gray-700">
              <VideoPlaceholder nome={user?.full_name} role="Voce" />
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className={`rounded-full w-12 h-12 border-gray-700 ${micOn ? 'bg-gray-800 text-white' : 'bg-red-600 text-white border-red-600'}`}
              onClick={() => setMicOn((value) => !value)}
            >
              {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className={`rounded-full w-12 h-12 border-gray-700 ${camOn ? 'bg-gray-800 text-white' : 'bg-red-600 text-white border-red-600'}`}
              onClick={() => setCamOn((value) => !value)}
            >
              {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </Button>
            <Button
              size="icon"
              className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-700 text-white"
              onClick={() => encerrar.mutate()}
              disabled={encerrar.isPending}
            >
              {encerrar.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <PhoneOff className="w-6 h-6" />}
            </Button>
          </div>
        </div>

        <div className="lg:w-96 border-t lg:border-t-0 lg:border-l border-gray-800 flex flex-col bg-gray-900">
          <Tabs defaultValue="chat" className="flex-1 flex flex-col min-h-0">
            <TabsList className="bg-gray-800 m-2 rounded-lg shrink-0">
              <TabsTrigger value="chat" className="flex-1 text-gray-300 data-[state=active]:text-white data-[state=active]:bg-gray-700">
                <MessageSquare className="w-4 h-4 mr-1" />Chat
              </TabsTrigger>
              {isProfissional && (
                <TabsTrigger value="prontuario" className="flex-1 text-gray-300 data-[state=active]:text-white data-[state=active]:bg-gray-700">
                  <FileText className="w-4 h-4 mr-1" />Prontuario
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="chat" className="flex-1 overflow-hidden m-0 flex flex-col min-h-0" style={{ height: 0 }}>
              <div className="flex-1 flex flex-col min-h-0 h-full">
                <ChatPanel
                  consultaId={consultaId}
                  userId={user?.id}
                  userName={user?.full_name}
                  userTipo={userTipo}
                />
              </div>
            </TabsContent>

            {isProfissional && (
              <TabsContent value="prontuario" className="flex-1 overflow-y-auto m-0 p-3 min-h-0">
                <div className="mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-gray-300 border-gray-600 hover:bg-gray-700"
                    onClick={() => setShowProntuariosAnt(true)}
                  >
                    <History className="w-3.5 h-3.5 mr-1" />
                    Prontuarios Anteriores
                  </Button>
                </div>
                {consulta.descricao_sintomas && (
                  <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <p className="text-xs font-medium text-amber-400 mb-1">Sintomas do paciente</p>
                    <p className="text-xs text-gray-300">{consulta.descricao_sintomas}</p>
                  </div>
                )}
                <ProntuarioForm
                  consultaId={consultaId}
                  pacienteId={consulta.paciente_id}
                  profissionalId={consulta.profissional_id}
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
