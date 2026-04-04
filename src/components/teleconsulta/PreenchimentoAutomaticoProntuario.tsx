// Objetivo: Automatizar o preenchimento do prontuário eletrônico durante a consulta de telemedicina.
// O médico clica em "Iniciar Preenchimento Automático", a IA escuta a conversa, transcreve em tempo real e, ao parar, preenche automaticamente todos os campos do prontuário com uma única chamada de IA (Groq). O médico sempre revisa antes de salvar.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Sparkles, Waves } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

export type ProntuarioAutomaticoFields = {
  motivo_da_consulta: string;
  historico_e_fatores_de_risco: string;
  exames_imagens: string;
  exame_fisico: string;
  avaliacao_diagnostica: string;
  recomendacoes_e_conduta: string;
};

type DeepgramConnectionLike = {
  on?: (event: string, handler: (payload: any) => void) => void;
  connect?: () => void;
  waitForOpen?: () => Promise<void>;
  requestClose?: () => void;
  finish?: () => void;
  disconnect?: () => void;
  send?: (chunk: ArrayBuffer | Blob) => void;
  sendMedia?: (chunk: ArrayBuffer | Blob) => void;
  socket?: { close?: (code?: number, reason?: string) => void };
};

type AudioProcessingRefs = {
  audioContext: AudioContext | null;
  sourceNode: MediaStreamAudioSourceNode | null;
  processorNode: ScriptProcessorNode | null;
  gainNode: GainNode | null;
};

interface PreenchimentoAutomaticoProntuarioProps {
  disabled?: boolean;
  onApply: (data: ProntuarioAutomaticoFields) => void;
}

const EMPTY_PRONTUARIO_FIELDS: ProntuarioAutomaticoFields = {
  motivo_da_consulta: '',
  historico_e_fatores_de_risco: '',
  exames_imagens: '',
  exame_fisico: '',
  avaliacao_diagnostica: '',
  recomendacoes_e_conduta: '',
};

function parseGroqJsonResponse(rawContent: string): ProntuarioAutomaticoFields {
  const cleaned = rawContent
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');

  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  const candidate = jsonStart >= 0 && jsonEnd >= 0
    ? cleaned.slice(jsonStart, jsonEnd + 1)
    : cleaned;

  const parsed = JSON.parse(candidate);

  return {
    motivo_da_consulta: String(parsed?.motivo_da_consulta || '').trim(),
    historico_e_fatores_de_risco: String(parsed?.historico_e_fatores_de_risco || '').trim(),
    exames_imagens: String(parsed?.exames_imagens || '').trim(),
    exame_fisico: String(parsed?.exame_fisico || '').trim(),
    avaliacao_diagnostica: String(parsed?.avaliacao_diagnostica || '').trim(),
    recomendacoes_e_conduta: String(parsed?.recomendacoes_e_conduta || '').trim(),
  };
}

function convertFloat32ToInt16Buffer(input: Float32Array) {
  const pcmBuffer = new ArrayBuffer(input.length * 2);
  const pcmView = new DataView(pcmBuffer);

  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    pcmView.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return pcmBuffer;
}

function normalizeTranscriptPayload(payload: any) {
  const data = payload?.type === 'Results' ? payload : payload?.channel ? payload : payload?.data || payload;
  const transcript = String(data?.channel?.alternatives?.[0]?.transcript || '').trim();

  return {
    transcript,
    isFinal: Boolean(data?.is_final),
  };
}

async function getConsultaMediaStream(): Promise<MediaStream> {
  // TODO: substituir este fallback pelo MediaStream real da videochamada WebRTC na rota /consulta.
  // Exemplo esperado aqui:
  // return activePeerConnection.getReceivers()[0].track ou um MediaStream já exposto pela página da consulta.
  // Enquanto esse ponto não for conectado ao stream real da sala, usamos o microfone local como fallback.
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Seu navegador não suporta captura de áudio para transcrição.');
  }

  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
}

function stopMediaCapture(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

async function stopAudioProcessing(audioRefs: AudioProcessingRefs) {
  try {
    audioRefs.processorNode?.disconnect();
    audioRefs.sourceNode?.disconnect();
    audioRefs.gainNode?.disconnect();
  } catch {
    // noop
  }

  audioRefs.processorNode = null;
  audioRefs.sourceNode = null;
  audioRefs.gainNode = null;

  if (audioRefs.audioContext) {
    try {
      await audioRefs.audioContext.close();
    } catch {
      // noop
    }
  }

  audioRefs.audioContext = null;
}

function closeDeepgramConnection(connection: DeepgramConnectionLike | null) {
  if (typeof connection?.requestClose === 'function') {
    connection.requestClose();
    return;
  }

  if (typeof connection?.finish === 'function') {
    connection.finish();
    return;
  }

  if (typeof connection?.disconnect === 'function') {
    connection.disconnect();
    return;
  }

  connection?.socket?.close?.(1000, 'user-stopped');
}

function sendAudioChunk(connection: DeepgramConnectionLike | null, chunk: ArrayBuffer) {
  if (!connection) {
    return;
  }

  if (typeof connection.send === 'function') {
    connection.send(chunk);
    return;
  }

  if (typeof connection.sendMedia === 'function') {
    connection.sendMedia(chunk);
  }
}

export default function PreenchimentoAutomaticoProntuario({
  disabled = false,
  onApply,
}: PreenchimentoAutomaticoProntuarioProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [transcriptFull, setTranscriptFull] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioProcessingRef = useRef<AudioProcessingRefs>({
    audioContext: null,
    sourceNode: null,
    processorNode: null,
    gainNode: null,
  });
  const deepgramConnectionRef = useRef<DeepgramConnectionLike | null>(null);
  const transcriptFullRef = useRef('');
  const lastTranscriptSnapshotRef = useRef('');
  const isUnmountingRef = useRef(false);

  const displayTranscript = useMemo(() => {
    const combinedTranscript = [transcriptFull, interimTranscript].filter(Boolean).join('\n');

    if (combinedTranscript) {
      return combinedTranscript;
    }

    return 'A transcrição ao vivo aparecerá aqui assim que a conversa for capturada.';
  }, [interimTranscript, transcriptFull]);

  useEffect(() => {
    if (!transcriptScrollRef.current) {
      return;
    }

    transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
  }, [displayTranscript]);

  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
      closeDeepgramConnection(deepgramConnectionRef.current);
      stopMediaCapture(mediaStreamRef.current);
      void stopAudioProcessing(audioProcessingRef.current);
    };
  }, []);

  const processTranscriptWithGroq = async (transcript: string) => {
    const { data, error } = await supabase.functions.invoke('groq-completion', {
      body: { transcript },
    });

    if (error || !data?.content) {
      throw new Error(data?.error || error?.message || 'A IA não retornou um conteúdo válido para o prontuário.');
    }

    return parseGroqJsonResponse(data.content);
  };

  const appendFinalTranscript = (nextChunk: string) => {
    const trimmedChunk = nextChunk.trim();

    if (!trimmedChunk) {
      return;
    }

    transcriptFullRef.current = transcriptFullRef.current
      ? `${transcriptFullRef.current}\n${trimmedChunk}`
      : trimmedChunk;

    setTranscriptFull(transcriptFullRef.current);
    setInterimTranscript('');
  };

  const startListening = async () => {
    if (disabled || isListening || isProcessing) {
      return;
    }

    try {
      setErrorMessage(null);
      setTranscriptFull('');
      setInterimTranscript('');
      transcriptFullRef.current = '';
      lastTranscriptSnapshotRef.current = '';
      setIsPanelOpen(true);
      setIsListening(true);

      // Fetch Deepgram key from edge function
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('deepgram-token', {
        body: {},
      });

      if (tokenError || !tokenData?.key) {
        throw new Error(tokenData?.error || tokenError?.message || 'Não foi possível obter o token do Deepgram.');
      }

      const deepgramApiKey = tokenData.key;

      const { createClient, LiveTranscriptionEvents } = await import('@deepgram/sdk');

      const stream = await getConsultaMediaStream();
      mediaStreamRef.current = stream;

      const audioContext = new window.AudioContext();
      await audioContext.resume();

      const sourceNode = audioContext.createMediaStreamSource(stream);
      const processorNode = audioContext.createScriptProcessor(4096, 1, 1);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0;

      audioProcessingRef.current.audioContext = audioContext;
      audioProcessingRef.current.sourceNode = sourceNode;
      audioProcessingRef.current.processorNode = processorNode;
      audioProcessingRef.current.gainNode = gainNode;

      const deepgramClient = createClient(deepgramApiKey);
      const listenOptions = {
        model: 'nova-3',
        language: 'pt',
        smart_format: true,
        interim_results: true,
        punctuate: true,
        encoding: 'linear16',
        sample_rate: audioContext.sampleRate,
        channels: 1,
        no_delay: true,
      };
      const connection = typeof deepgramClient.listen?.live === 'function'
        ? deepgramClient.listen.live(listenOptions)
        : typeof (deepgramClient.listen as any)?.v1?.connect === 'function'
          ? await (deepgramClient.listen as any).v1.connect(listenOptions)
          : null;

      if (!connection) {
        throw new Error('Não foi possível abrir a conexão de transcrição ao vivo.');
      }

      deepgramConnectionRef.current = connection;

      const transcriptEventName = LiveTranscriptionEvents?.Transcript || 'Results';
      const openEventName = LiveTranscriptionEvents?.Open || 'open';
      const errorEventName = LiveTranscriptionEvents?.Error || 'error';

      connection.on?.(openEventName, () => {
        setErrorMessage(null);
      });

      connection.on?.(transcriptEventName, (payload: any) => {
        const normalized = normalizeTranscriptPayload(payload);

        if (!normalized.transcript) {
          return;
        }

        const snapshot = `${normalized.isFinal ? 'final' : 'partial'}:${normalized.transcript}`;
        if (lastTranscriptSnapshotRef.current === snapshot) {
          return;
        }

        lastTranscriptSnapshotRef.current = snapshot;

        if (normalized.isFinal) {
          appendFinalTranscript(normalized.transcript);
          return;
        }

        setInterimTranscript(normalized.transcript);
      });

      connection.on?.('message', (payload: any) => {
        const normalized = normalizeTranscriptPayload(payload);

        if (!normalized.transcript) {
          return;
        }

        const snapshot = `${normalized.isFinal ? 'final' : 'partial'}:${normalized.transcript}`;
        if (lastTranscriptSnapshotRef.current === snapshot) {
          return;
        }

        lastTranscriptSnapshotRef.current = snapshot;

        if (normalized.isFinal) {
          appendFinalTranscript(normalized.transcript);
          return;
        }

        setInterimTranscript(normalized.transcript);
      });

      connection.on?.(errorEventName, (event: any) => {
        const nextErrorMessage = String(event?.message || event || 'Erro ao transcrever a consulta.');
        setErrorMessage(nextErrorMessage);
      });

      connection.connect?.();
      await connection.waitForOpen?.();

      processorNode.onaudioprocess = (event) => {
        if (!deepgramConnectionRef.current) {
          return;
        }

        const inputBuffer = event.inputBuffer.getChannelData(0);
        const pcmBuffer = convertFloat32ToInt16Buffer(inputBuffer);
        sendAudioChunk(deepgramConnectionRef.current, pcmBuffer);
      };

      sourceNode.connect(processorNode);
      processorNode.connect(gainNode);
      gainNode.connect(audioContext.destination);
    } catch (error) {
      closeDeepgramConnection(deepgramConnectionRef.current);
      stopMediaCapture(mediaStreamRef.current);
      void stopAudioProcessing(audioProcessingRef.current);
      deepgramConnectionRef.current = null;
      mediaStreamRef.current = null;
      setIsListening(false);
      setIsPanelOpen(false);

      const message = error instanceof Error
        ? error.message
        : 'Não foi possível iniciar o preenchimento automático.';

      setErrorMessage(message);
      toast({
        title: 'Falha ao iniciar a transcrição',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const stopListening = async () => {
    if (!isListening && !isProcessing) {
      return;
    }

    setIsListening(false);
    setIsPanelOpen(false);

    try {
      await stopAudioProcessing(audioProcessingRef.current);
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;

      await new Promise((resolve) => window.setTimeout(resolve, 350));
      closeDeepgramConnection(deepgramConnectionRef.current);
      deepgramConnectionRef.current = null;

      const finalTranscript = transcriptFullRef.current.trim();
      if (!finalTranscript) {
        toast({
          title: 'Nenhuma transcrição foi capturada',
          description: 'Tente novamente após confirmar o áudio da consulta.',
          variant: 'destructive',
        });
        return;
      }

      setIsProcessing(true);
      const autoFilledFields = await processTranscriptWithGroq(finalTranscript);
      if (isUnmountingRef.current) {
        return;
      }

      onApply({
        ...EMPTY_PRONTUARIO_FIELDS,
        ...autoFilledFields,
      });

      toast({
        title: '✅ Prontuário preenchido automaticamente! Revise e salve.',
      });
    } catch (error) {
      if (isUnmountingRef.current) {
        return;
      }

      const message = error instanceof Error
        ? error.message
        : 'Não foi possível preencher o prontuário automaticamente.';

      setErrorMessage(message);
      toast({
        title: 'Falha no preenchimento automático',
        description: message,
        variant: 'destructive',
      });
    } finally {
      if (!isUnmountingRef.current) {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={() => void (isListening ? stopListening() : startListening())}
        disabled={disabled || isProcessing}
        className={`w-full h-10 text-xs ${
          isListening
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-emerald-600 hover:bg-emerald-700'
        }`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Processando transcrição IA...
          </>
        ) : isListening ? (
          '⏹️ Parar Preenchimento Automático'
        ) : (
          '▶️ Iniciar Preenchimento Automático IA'
        )}
      </Button>

      <p className="text-[11px] text-gray-400">
        A IA apenas sugere o preenchimento. O médico revisa e salva o prontuário manualmente.
      </p>

      {errorMessage && (
        <p className="text-[11px] text-red-300">{errorMessage}</p>
      )}

      <Sheet open={isPanelOpen} onOpenChange={setIsPanelOpen}>
        <SheetContent
          side="right"
          className="w-full border-gray-700 bg-gray-900 p-0 text-white sm:max-w-xl [&>button]:text-gray-400 [&>button]:hover:text-white"
        >
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-gray-800 px-5 py-4">
              <SheetTitle className="flex items-center gap-2 text-white">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                Transcrição ao Vivo - Assistente IA
              </SheetTitle>
              <SheetDescription className="text-xs text-gray-400">
                Paciente autorizou a transcrição para auxiliar o preenchimento automático do prontuário.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-hidden px-5 py-4">
              <div
                ref={transcriptScrollRef}
                className="h-full min-h-[320px] overflow-y-auto rounded-xl border border-gray-700 bg-gray-950 p-4 text-sm leading-6 text-gray-100 shadow-inner whitespace-pre-wrap"
              >
                {displayTranscript}
              </div>
            </div>

            <div className="border-t border-gray-800 px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-red-200">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                  </span>
                  Escutando...
                </div>
                <div className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Waves className="h-3.5 w-3.5 text-emerald-400" />
                  Atualização por frase em tempo real
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
