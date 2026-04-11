import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Sparkles, Waves } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/components/ui/use-toast';
import { requestDeepgramToken, requestGroqCompletion } from '@/client-api/teleconsulta';

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
  consultationId: string;
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

function downsampleTo16kHz(input: Float32Array, sourceSampleRate: number) {
  const targetSampleRate = 16000;

  if (sourceSampleRate <= targetSampleRate) {
    return input;
  }

  const sampleRateRatio = sourceSampleRate / targetSampleRate;
  const newLength = Math.round(input.length / sampleRateRatio);
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accumulator = 0;
    let count = 0;

    for (let index = offsetBuffer; index < nextOffsetBuffer && index < input.length; index += 1) {
      accumulator += input[index];
      count += 1;
    }

    result[offsetResult] = count > 0 ? accumulator / count : 0;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

function normalizeTranscriptPayload(payload: any) {
  const data = payload?.type === 'Results'
    ? payload
    : payload?.channel
      ? payload
      : payload?.data || payload;

  return {
    transcript: String(data?.channel?.alternatives?.[0]?.transcript || '').trim(),
    isFinal: Boolean(data?.is_final),
    speechFinal: Boolean(data?.speech_final),
    type: String(data?.type || payload?.type || ''),
  };
}

async function getConsultaMediaStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Seu navegador nao suporta captura de audio para transcricao.');
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
  consultationId,
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
  const currentUtteranceSegmentsRef = useRef<string[]>([]);
  const lastTranscriptSnapshotRef = useRef('');
  const isUnmountingRef = useRef(false);

  const displayTranscript = useMemo(() => {
    const combinedTranscript = [transcriptFull, interimTranscript].filter(Boolean).join('\n');
    return combinedTranscript || 'A transcricao ao vivo aparecera aqui assim que a conversa for capturada.';
  }, [interimTranscript, transcriptFull]);

  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [displayTranscript]);

  useEffect(() => () => {
    isUnmountingRef.current = true;
    closeDeepgramConnection(deepgramConnectionRef.current);
    stopMediaCapture(mediaStreamRef.current);
    void stopAudioProcessing(audioProcessingRef.current);
  }, []);

  const processTranscriptWithGroq = async (transcript: string) => {
    const result = await requestGroqCompletion({
      consultationId,
      transcript,
    });

    if (!result?.content) {
      throw new Error('A IA nao retornou um conteudo valido para o prontuario.');
    }

    return parseGroqJsonResponse(result.content);
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

  const updateLiveTranscript = (partialTranscript = '') => {
    const stableTranscript = currentUtteranceSegmentsRef.current.join(' ').trim();
    const partial = partialTranscript.trim();
    setInterimTranscript([stableTranscript, partial].filter(Boolean).join(' ').trim());
  };

  const pushStableSegment = (segment: string) => {
    const trimmedSegment = segment.trim();

    if (!trimmedSegment) {
      return;
    }

    const lastSegment = currentUtteranceSegmentsRef.current[currentUtteranceSegmentsRef.current.length - 1];
    if (lastSegment !== trimmedSegment) {
      currentUtteranceSegmentsRef.current = [...currentUtteranceSegmentsRef.current, trimmedSegment];
    }
  };

  const commitCurrentUtterance = () => {
    const utterance = currentUtteranceSegmentsRef.current.join(' ').replace(/\s+/g, ' ').trim();

    if (!utterance) {
      setInterimTranscript('');
      return;
    }

    appendFinalTranscript(utterance);
    currentUtteranceSegmentsRef.current = [];
    setInterimTranscript('');
    lastTranscriptSnapshotRef.current = '';
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
      currentUtteranceSegmentsRef.current = [];
      lastTranscriptSnapshotRef.current = '';
      setIsPanelOpen(true);
      setIsListening(true);

      const tokenData = await requestDeepgramToken({
        consultationId,
      });

      if (!tokenData?.key) {
        throw new Error('Nao foi possivel obter o token do Deepgram.');
      }

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

      const deepgramClient = createClient(tokenData.key);
      const listenOptions = {
        model: 'nova-3',
        language: 'pt',
        smart_format: true,
        interim_results: true,
        punctuate: true,
        endpointing: 500,
        utterance_end_ms: 1200,
        vad_events: true,
        encoding: 'linear16',
        sample_rate: 16000,
        channels: 1,
        no_delay: true,
      };

      const connection = typeof deepgramClient.listen?.live === 'function'
        ? deepgramClient.listen.live(listenOptions)
        : typeof (deepgramClient.listen as any)?.v1?.connect === 'function'
          ? await (deepgramClient.listen as any).v1.connect(listenOptions)
          : null;

      if (!connection) {
        throw new Error('Nao foi possivel abrir a conexao de transcricao ao vivo.');
      }

      deepgramConnectionRef.current = connection;

      const transcriptEventName = LiveTranscriptionEvents?.Transcript || 'Results';
      const openEventName = LiveTranscriptionEvents?.Open || 'open';
      const errorEventName = LiveTranscriptionEvents?.Error || 'error';

      const handleTranscriptEvent = (payload: any) => {
        const normalized = normalizeTranscriptPayload(payload);

        if (!normalized.transcript) {
          if (normalized.type === 'UtteranceEnd') {
            commitCurrentUtterance();
          }
          return;
        }

        const snapshot = `${normalized.isFinal ? 'final' : 'partial'}:${normalized.transcript}`;
        if (lastTranscriptSnapshotRef.current === snapshot) {
          return;
        }

        lastTranscriptSnapshotRef.current = snapshot;

        if (normalized.isFinal) {
          pushStableSegment(normalized.transcript);

          if (normalized.speechFinal) {
            commitCurrentUtterance();
            return;
          }

          updateLiveTranscript();
          return;
        }

        updateLiveTranscript(normalized.transcript);
      };

      connection.on?.(openEventName, () => setErrorMessage(null));
      connection.on?.(transcriptEventName, handleTranscriptEvent);
      connection.on?.('message', handleTranscriptEvent);
      connection.on?.(errorEventName, (event: any) => {
        setErrorMessage(String(event?.message || event || 'Erro ao transcrever a consulta.'));
      });

      connection.connect?.();
      await connection.waitForOpen?.();

      processorNode.onaudioprocess = (event) => {
        if (!deepgramConnectionRef.current) {
          return;
        }

        const inputBuffer = event.inputBuffer.getChannelData(0);
        const downsampledBuffer = downsampleTo16kHz(inputBuffer, audioContext.sampleRate);
        const pcmBuffer = convertFloat32ToInt16Buffer(downsampledBuffer);
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
        : 'Nao foi possivel iniciar o preenchimento automatico.';

      setErrorMessage(message);
      toast({
        title: 'Falha ao iniciar a transcricao',
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
      stopMediaCapture(mediaStreamRef.current);
      mediaStreamRef.current = null;

      await new Promise((resolve) => window.setTimeout(resolve, 350));
      commitCurrentUtterance();
      closeDeepgramConnection(deepgramConnectionRef.current);
      deepgramConnectionRef.current = null;

      const finalTranscript = transcriptFullRef.current.trim();
      if (!finalTranscript) {
        toast({
          title: 'Nenhuma transcricao foi capturada',
          description: 'Tente novamente apos confirmar o audio da consulta.',
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
        title: 'Prontuario preenchido automaticamente. Revise e salve.',
      });
    } catch (error) {
      if (isUnmountingRef.current) {
        return;
      }

      const message = error instanceof Error
        ? error.message
        : 'Nao foi possivel preencher o prontuario automaticamente.';

      setErrorMessage(message);
      toast({
        title: 'Falha no preenchimento automatico',
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
        className={`h-10 w-full text-xs ${
          isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
        }`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Processando transcricao IA...
          </>
        ) : isListening ? (
          'Parar preenchimento automatico'
        ) : (
          'Iniciar preenchimento automatico IA'
        )}
      </Button>

      <p className="text-[11px] text-gray-400">
        A IA apenas sugere o preenchimento. O medico revisa e salva o prontuario manualmente.
      </p>

      {errorMessage && <p className="text-[11px] text-red-300">{errorMessage}</p>}

      <Sheet open={isPanelOpen} onOpenChange={setIsPanelOpen}>
        <SheetContent
          side="right"
          className="w-full border-gray-700 bg-gray-900 p-0 text-white sm:max-w-xl [&>button]:text-gray-400 [&>button]:hover:text-white"
        >
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-gray-800 px-5 py-4">
              <SheetTitle className="flex items-center gap-2 text-white">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                Transcricao ao vivo - Assistente IA
              </SheetTitle>
              <SheetDescription className="text-xs text-gray-400">
                Paciente autorizou a transcricao para auxiliar o preenchimento automatico do prontuario.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-hidden px-5 py-4">
              <div
                ref={transcriptScrollRef}
                className="h-full min-h-[320px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-gray-700 bg-gray-950 p-4 text-sm leading-6 text-gray-100 shadow-inner"
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
                  Atualizacao por frase em tempo real
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
