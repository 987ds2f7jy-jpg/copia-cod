import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
// Use the same AuthContext as the rest of the app (components/AuthContext for AppUser)
import { useAuth } from '@/components/AuthContext';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Send, Loader2,
  FileText, MessageSquare, ChevronLeft, Star, Clock, User,
  AlertCircle, History
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ProntuarioForm from '@/components/teleconsulta/ProntuarioForm';
import ProntuariosAnteriores from '@/components/teleconsulta/ProntuariosAnteriores';
import AvaliacaoModal from '@/components/teleconsulta/AvaliacaoModal';

function VideoPlaceholder({ nome, role }) {
  return (
    <div className="relative w-full h-full bg-gray-900 rounded-xl flex flex-col items-center justify-center select-none">
      <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center mb-3">
        <User className="w-10 h-10 text-gray-400" />
      </div>
      <p className="text-white text-sm font-medium">{nome || 'Participante'}</p>
      <p className="text-gray-400 text-xs mt-1">{role}</p>
      <div className="absolute top-3 left-3">
        <Badge className="bg-red-500 text-white text-xs animate-pulse">● AO VIVO</Badge>
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (texto.trim()) enviar.mutate();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {mensagens.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-4">Nenhuma mensagem ainda</p>
        )}
        {mensagens.map(m => {
          const isMe = m.remetente_id === userId;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${isMe ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                {!isMe && <p className="text-xs font-medium mb-1 opacity-70">{m.remetente_nome}</p>}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.mensagem}</p>
                <p className={`text-xs mt-1 ${isMe ? 'text-emerald-200' : 'text-gray-400'}`}>
                  {m.created_date ? format(new Date(m.created_date), 'HH:mm') : ''}
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
            onChange={e => setTexto(e.target.value)}
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
    queryFn: async () => {
      // Fetch by listing all and filter by id (entidades não têm endpoint GET by id diretamente)
      const results = await base44.entities.Consulta.list('-created_date', 200);
      const found = results.find(c => c.id === consultaId);
      console.log('[Teleconsulta] consulta encontrada:', found?.id, 'status:', found?.status,
        'tipo:', found?.tipo_consulta, 'inicio_at:', found?.inicio_at, 'datetime:', found?.datetime);
      return found || null;
    },
    enabled: !!consultaId,
    refetchInterval: 5000,
  });

  const isProfissional = consulta && user && consulta.profissional_id === user.id;
  const isPaciente = consulta && user && consulta.paciente_id === user.id;

  console.log('[Teleconsulta] consulta_id:', consultaId, 'status:', consulta?.status,
    'tipo:', consulta?.tipo_consulta, 'inicio_at:', consulta?.inicio_at, 'user:', user?.id);

  // Iniciar consulta ao montar se ainda não iniciada
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
    if (consulta && consulta.status === 'aguardando' && (isProfissional || isPaciente)) {
      console.log('[Teleconsulta] iniciando consulta automaticamente');
      iniciarConsulta.mutate();
    }
  }, [consulta?.id, consulta?.status]);

  const encerrar = useMutation({
    mutationFn: () => base44.entities.Consulta.update(consultaId, {
      status: 'finalizada',
      fim_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      if (isPaciente) {
        setShowAvaliacao(true);
      } else {
        navigate('/DashboardProfissional');
      }
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
        <p className="text-lg">Consulta não encontrada</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
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
        <p className="text-gray-400">Duração: {
          consulta.inicio_at && consulta.fim_at
            ? Math.round((new Date(consulta.fim_at) - new Date(consulta.inicio_at)) / 60000) + ' min'
            : '—'
        }</p>
        <div className="flex gap-3">
          <Button onClick={() => navigate('/DashboardPaciente')} className="bg-emerald-600 hover:bg-emerald-700">
            Voltar ao Início
          </Button>
        </div>
      </div>
    );
  }

  const nomeOutro = isProfissional ? consulta.paciente_nome : consulta.profissional_nome;
  const userTipo = isProfissional ? 'profissional' : 'paciente';
  const TIPO_LABELS = { padrao: 'Por Especialidade', prioritario: 'Prioritária', especialidade: 'Por Especialidade', plantao: 'Plantão' };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <p className="text-white font-medium text-sm">{nomeOutro || 'Consulta'}</p>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">{TIPO_LABELS[consulta.tipo_consulta] || consulta.tipo_consulta}</Badge>
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
          {consulta.status === 'em_atendimento' ? '● Em andamento' : consulta.status}
        </Badge>
      </div>

      {/* Layout Desktop: Video + Sidebar */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Área principal de vídeo */}
        <div className="flex-1 flex flex-col p-4 gap-3 min-h-[300px] lg:min-h-0">
          <div className="flex-1 relative">
            <VideoPlaceholder nome={nomeOutro} role={isProfissional ? 'Paciente' : `Dr(a). ${consulta.profissional_nome}`} />
            {/* Mini preview de si mesmo */}
            <div className="absolute bottom-3 right-3 w-28 h-20 rounded-lg overflow-hidden border-2 border-gray-700">
              <VideoPlaceholder nome={user?.full_name} role="Você" />
            </div>
          </div>

          {/* Controles */}
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className={`rounded-full w-12 h-12 border-gray-700 ${micOn ? 'bg-gray-800 text-white' : 'bg-red-600 text-white border-red-600'}`}
              onClick={() => setMicOn(v => !v)}
            >
              {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className={`rounded-full w-12 h-12 border-gray-700 ${camOn ? 'bg-gray-800 text-white' : 'bg-red-600 text-white border-red-600'}`}
              onClick={() => setCamOn(v => !v)}
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

        {/* Sidebar */}
        <div className="lg:w-96 border-t lg:border-t-0 lg:border-l border-gray-800 flex flex-col bg-gray-900">
          <Tabs defaultValue="chat" className="flex-1 flex flex-col min-h-0">
            <TabsList className="bg-gray-800 m-2 rounded-lg shrink-0">
              <TabsTrigger value="chat" className="flex-1 text-gray-300 data-[state=active]:text-white data-[state=active]:bg-gray-700">
                <MessageSquare className="w-4 h-4 mr-1" />Chat
              </TabsTrigger>
              {isProfissional && (
                <TabsTrigger value="prontuario" className="flex-1 text-gray-300 data-[state=active]:text-white data-[state=active]:bg-gray-700">
                  <FileText className="w-4 h-4 mr-1" />Prontuário
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
                    Prontuários Anteriores
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

      {/* Modal prontuários anteriores */}
      {isProfissional && (
        <ProntuariosAnteriores
          open={showProntuariosAnt}
          onClose={() => setShowProntuariosAnt(false)}
          pacienteId={consulta?.paciente_id}
        />
      )}

      {/* Modal avaliação pós-consulta */}
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
  // Fallback para query param ?id=xxx
  const qp = new URLSearchParams(window.location.search).get('id');
  return <TeleconsultaInner consultaId={consultaId || qp} />;
}