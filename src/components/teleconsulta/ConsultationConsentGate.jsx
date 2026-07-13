import React, { useRef, useState } from 'react';
import { AlertTriangle, Bot, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { LEGAL_DOCUMENTS, legalConfig } from '@/config/legal';

const TELEMEDICINE = LEGAL_DOCUMENTS.telemedicine_consent;
const TRANSCRIPTION = LEGAL_DOCUMENTS.consultation_transcription_consent;
const AI_NOTICE = LEGAL_DOCUMENTS.ai_assistance_notice;

function createIdempotencyKey(prefix) {
  const suffix = typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

export default function ConsultationConsentGate({ consents, onRecordDecision }) {
  const [telemedicineChecked, setTelemedicineChecked] = useState(Boolean(consents?.telemedicine?.granted));
  const [transcriptionChoice, setTranscriptionChoice] = useState(
    consents?.transcription?.decision === 'granted' ? 'granted'
      : consents?.transcription?.decision === 'declined' ? 'declined'
        : '',
  );
  const [aiNoticeChecked, setAiNoticeChecked] = useState(Boolean(consents?.aiAssistanceAllowed));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const idempotencyKeys = useRef({
    telemedicine: createIdempotencyKey('telemedicine'),
    transcription: createIdempotencyKey('transcription'),
    ai: createIdempotencyKey('ai-notice'),
  });

  const submit = async () => {
    if (!telemedicineChecked || !transcriptionChoice) return;
    if (transcriptionChoice === 'granted' && !aiNoticeChecked) return;

    setIsSubmitting(true);
    setError('');

    try {
      await onRecordDecision({
        consentKey: 'consultation_transcription_consent',
        decision: transcriptionChoice,
        idempotencyKey: idempotencyKeys.current.transcription,
      });

      if (transcriptionChoice === 'granted') {
        await onRecordDecision({
          consentKey: 'ai_assistance_notice',
          decision: 'acknowledged',
          idempotencyKey: idempotencyKeys.current.ai,
        });
      }

      await onRecordDecision({
        consentKey: 'telemedicine_consent',
        decision: 'granted',
        idempotencyKey: idempotencyKeys.current.telemedicine,
      });
    } catch (submitError) {
      setError(submitError?.message || 'Nao foi possivel registrar suas escolhas. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground dark:bg-gray-950 dark:text-white">
      <Card className="mx-auto max-w-3xl border-border bg-card shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-500/10">
            <ShieldCheck className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
          </div>
          <CardTitle className="text-xl">Preparação para a teleconsulta</CardTitle>
          <p className="text-sm text-muted-foreground">Revise as escolhas abaixo antes de entrar. A transcrição é opcional.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-3 rounded-lg border border-border p-4 dark:border-gray-700">
            <h2 className="font-semibold">{TELEMEDICINE.title}</h2>
            <p className="text-sm text-muted-foreground">
              O atendimento será remoto e exige transmissão de imagem, áudio e dados entre paciente e profissional. Pode haver limitações técnicas, interrupção ou necessidade de avaliação presencial. Em emergência, procure um serviço de urgência ou ligue 192.
            </p>
            <details className="text-sm text-muted-foreground">
              <summary className="cursor-pointer font-medium text-primary">Ver texto completo</summary>
              <div className="mt-3 space-y-2 rounded-md bg-muted/50 p-3">
                <p>Plataforma: {legalConfig.legalName}, CNPJ {legalConfig.cnpj}, endereço {legalConfig.companyAddress}.</p>
                <p>A teleconsulta utiliza transmissão em tempo real de imagem, áudio, mensagens e dados necessários ao atendimento. O Rápido Doutor não realiza gravação permanente de áudio ou vídeo nesta funcionalidade.</p>
                <p>Falhas de conexão ou equipamento podem exigir reconexão, interrupção ou reagendamento. O profissional pode recomendar exame presencial, encaminhamento ou atendimento de urgência.</p>
                <p>O atendimento deve ocorrer em ambiente reservado. Documentos e registros clínicos serão tratados conforme as obrigações profissionais e o Aviso de Privacidade, que não substitui esta autorização específica.</p>
                <p>Contato: {legalConfig.supportEmail}. Texto técnico inicial sujeito a revisão jurídica antes da produção.</p>
                <p>Versão {TELEMEDICINE.version} · Vigência {TELEMEDICINE.effectiveDate}</p>
              </div>
            </details>
            <div className="flex items-start gap-3">
              <Checkbox
                id="telemedicine-consent"
                checked={telemedicineChecked}
                onCheckedChange={(checked) => setTelemedicineChecked(checked === true)}
              />
              <Label htmlFor="telemedicine-consent" className="font-normal leading-5">
                Li as informações e autorizo a realização desta consulta por telemedicina.
              </Label>
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-border p-4 dark:border-gray-700">
            <h2 className="font-semibold">{TRANSCRIPTION.title}</h2>
            <p className="text-sm text-muted-foreground">
              Se autorizada, o áudio será capturado durante a sessão e processado temporariamente pelo Deepgram para produzir texto. O Rápido Doutor não grava nem armazena o áudio ou a transcrição completa neste fluxo. A recusa não impede a consulta.
            </p>
            <RadioGroup value={transcriptionChoice} onValueChange={setTranscriptionChoice} className="space-y-2">
              <div className="flex items-start gap-3 rounded-md border border-border p-3 dark:border-gray-700">
                <RadioGroupItem id="transcription-granted" value="granted" />
                <Label htmlFor="transcription-granted" className="font-normal">Autorizar transcrição</Label>
              </div>
              <div className="flex items-start gap-3 rounded-md border border-border p-3 dark:border-gray-700">
                <RadioGroupItem id="transcription-declined" value="declined" />
                <Label htmlFor="transcription-declined" className="font-normal">Continuar sem transcrição</Label>
              </div>
            </RadioGroup>

            {transcriptionChoice === 'granted' && (
              <div className="space-y-3 rounded-md bg-muted/50 p-3">
                <div className="flex items-start gap-2">
                  <Bot className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    A transcrição poderá ser enviada ao Groq para organizar um rascunho de documentação. A IA não substitui o profissional, não decide diagnóstico ou conduta e não salva o prontuário. O profissional deve revisar e salvar manualmente.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="ai-assistance-notice"
                    checked={aiNoticeChecked}
                    onCheckedChange={(checked) => setAiNoticeChecked(checked === true)}
                  />
                  <Label htmlFor="ai-assistance-notice" className="font-normal leading-5">
                    Li o aviso sobre assistência de IA para esta consulta.
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">Versão {AI_NOTICE.version} · Vigência {AI_NOTICE.effectiveDate}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Versão {TRANSCRIPTION.version} · Vigência {TRANSCRIPTION.effectiveDate}</p>
          </section>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button
            type="button"
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={isSubmitting || !telemedicineChecked || !transcriptionChoice || (transcriptionChoice === 'granted' && !aiNoticeChecked)}
            onClick={() => void submit()}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar escolhas e continuar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function TranscriptionConsentControl({ consents, onRecordDecision }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const allowed = Boolean(consents?.transcriptionAllowed && consents?.aiAssistanceAllowed);

  const change = async () => {
    setBusy(true);
    setError('');
    try {
      if (allowed) {
        await onRecordDecision({
          consentKey: 'consultation_transcription_consent',
          decision: 'revoked',
          idempotencyKey: createIdempotencyKey('transcription-revoke'),
        });
      } else {
        await onRecordDecision({
          consentKey: 'consultation_transcription_consent',
          decision: 'granted',
          idempotencyKey: createIdempotencyKey('transcription-grant'),
        });
        await onRecordDecision({
          consentKey: 'ai_assistance_notice',
          decision: 'acknowledged',
          idempotencyKey: createIdempotencyKey('ai-notice'),
        });
      }
    } catch (changeError) {
      setError(changeError?.message || 'Nao foi possivel atualizar a decisao de transcricao.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 text-sm dark:border-gray-700 dark:bg-gray-900">
      <p className="font-medium">Transcrição para apoio</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {allowed ? 'Autorizada. Voce pode revogar novas capturas a qualquer momento.' : 'Desativada. A consulta continua normalmente sem transcrição.'}
      </p>
      <Button type="button" variant="outline" size="sm" className="mt-2" disabled={busy} onClick={() => void change()}>
        {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
        {allowed ? 'Revogar transcrição' : 'Autorizar transcrição e ciência de IA'}
      </Button>
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p>}
    </div>
  );
}
