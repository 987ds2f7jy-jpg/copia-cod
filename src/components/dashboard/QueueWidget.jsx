import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Users,
  Loader2,
  Clock,
  FileText,
  Paperclip,
  ClipboardList,
  Stethoscope,
  UserCircle2,
  ChevronRight,
  Video,
} from 'lucide-react';
import { getLaudoAttachmentUrls } from '@/lib/solicitacoesExames';
import NetAmountBadge from './NetAmountBadge';

function formatFieldValue(value, fallback = 'Nao informado') {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'string') {
    return value.trim() || fallback;
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : fallback;
  }

  return String(value);
}

function DetailItem({ label, value, multiline = false }) {
  return (
    <div className={`rounded-xl border border-border bg-muted/50 p-3 ${multiline ? 'col-span-2' : ''}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm text-foreground ${multiline ? 'whitespace-pre-wrap leading-6' : ''}`}>
        {formatFieldValue(value)}
      </p>
    </div>
  );
}

export default function QueueWidget({ queuePatients, onAccept, accepting }) {
  const [selectedPatientId, setSelectedPatientId] = useState(null);

  const selectedPatient = useMemo(
    () => queuePatients.find((patient) => patient.id === selectedPatientId) || null,
    [queuePatients, selectedPatientId],
  );

  const selectedLaudo = selectedPatient?.laudo_medico || null;
  const selectedIdentification = selectedLaudo?.dados_identificacao || {};
  const selectedHealthInfo = selectedLaudo?.informacoes_saude || selectedLaudo?.dados_saude || {};
  const selectedLaudoInfo = selectedLaudo?.especificacao_laudo || {};
  const selectedAttachments = getLaudoAttachmentUrls(selectedLaudo);

  return (
    <>
      <Card className="border-border shadow-sm bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" />
              Fila em Tempo Real
            </CardTitle>
            <Badge className={queuePatients.length > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-muted text-muted-foreground'}>
              {queuePatients.length} aguardando
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {queuePatients.length === 0 ? (
            <div className="px-6 pb-6 text-center">
              <p className="text-sm text-muted-foreground">Fila vazia</p>
            </div>
          ) : (
            <div className="space-y-3 px-4 pb-4">
              {queuePatients.map((patient, index) => {
                const laudo = patient.laudo_medico || null;
                const attachmentUrls = getLaudoAttachmentUrls(laudo);
                const laudoType = laudo?.especificacao_laudo?.tipo_laudo || 'Laudo em analise';
                const laudoSummary = laudo?.especificacao_laudo?.finalidade || laudo?.motivo || patient.symptoms || '';

                return (
                  <div
                    key={patient.id}
                    className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/40 px-4 py-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                          {index + 1}
                        </div>

                        <div className="min-w-0 space-y-2">
                          <div className="space-y-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-foreground">{patient.patient_name}</p>
                              <NetAmountBadge amount={patient.quoted_professional_net_amount} />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {laudo ? (
                                <>
                                  <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">Laudo</Badge>
                                  <Badge variant="outline" className="border-sky-200 text-sky-700">
                                    {laudoType}
                                  </Badge>
                                </>
                              ) : (
                                  <Badge variant="outline" className="border-emerald-200 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-300">
                                  Atendimento imediato
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                              {laudoSummary || 'Sem detalhes adicionais enviados pelo paciente.'}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                ~{patient.estimated_wait_time || '?'} min
                              </span>
                              {attachmentUrls.length > 0 ? (
                                <span className="inline-flex items-center gap-1">
                                  <Paperclip className="h-3 w-3" />
                                  {attachmentUrls.length} anexos
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {laudo ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-200"
                            onClick={() => setSelectedPatientId(patient.id)}
                            disabled={accepting}
                          >
                            <ClipboardList className="mr-1 h-3.5 w-3.5" />
                            Analise
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 shrink-0"
                            onClick={() => onAccept(patient)}
                            disabled={accepting}
                          >
                            {accepting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Video className="mr-1 h-3 w-3" />}
                            Atender
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={Boolean(selectedPatient)} onOpenChange={(open) => !open && setSelectedPatientId(null)}>
        <SheetContent
          side="right"
          className="w-full border-border bg-card p-0 text-foreground sm:max-w-2xl [&>button]:text-muted-foreground [&>button]:hover:text-foreground"
        >
          {selectedPatient ? (
            <div className="flex h-full flex-col">
              <SheetHeader className="border-b border-border px-6 py-5">
                <div className="flex items-center gap-2">
                  <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">Laudo</Badge>
                  <Badge variant="outline" className="border-sky-200 text-sky-700">
                    {selectedLaudoInfo?.tipo_laudo || 'Tipo nao informado'}
                  </Badge>
                  <NetAmountBadge amount={selectedPatient.quoted_professional_net_amount} />
                </div>
                <SheetTitle className="mt-2 text-xl text-foreground">{selectedPatient.patient_name}</SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  Revise os dados enviados pelo paciente antes de iniciar a consulta.
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="space-y-5">
                  <section className="space-y-3">
                    <div className="flex items-center gap-2">
                      <UserCircle2 className="h-4 w-4 text-emerald-600" />
                      <h3 className="text-sm font-semibold text-foreground">Dados do paciente</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <DetailItem label="Nome completo" value={selectedIdentification?.nome_completo || selectedPatient.patient_name} />
                      <DetailItem label="Data de nascimento" value={selectedIdentification?.data_nascimento} />
                      <DetailItem label="CPF" value={selectedIdentification?.cpf} />
                      <DetailItem label="Telefone" value={selectedIdentification?.telefone || selectedLaudo?.paciente_telefone} />
                      <DetailItem label="E-mail" value={selectedIdentification?.email || selectedLaudo?.paciente_email || selectedPatient.patient_email} multiline />
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-emerald-600" />
                      <h3 className="text-sm font-semibold text-foreground">Informacoes de saude</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <DetailItem label="Diagnostico ou motivo" value={selectedHealthInfo?.diagnostico} multiline />
                      <DetailItem label="Historico clinico" value={selectedHealthInfo?.historico} multiline />
                      <DetailItem label="Doencas cronicas" value={selectedHealthInfo?.doencas_cronicas} multiline />
                      <DetailItem label="Alergias" value={selectedHealthInfo?.alergias} multiline />
                      <DetailItem label="Medicamentos em uso" value={selectedHealthInfo?.medicamentos} multiline />
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-emerald-600" />
                      <h3 className="text-sm font-semibold text-foreground">Solicitacao do laudo</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <DetailItem label="Tipo de laudo" value={selectedLaudoInfo?.tipo_laudo} />
                      <DetailItem label="Tempo estimado na fila" value={`~${selectedPatient.estimated_wait_time || '?'} min`} />
                      <DetailItem label="Finalidade" value={selectedLaudoInfo?.finalidade || selectedLaudo?.motivo} multiline />
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-emerald-600" />
                      <h3 className="text-sm font-semibold text-foreground">Arquivos enviados</h3>
                    </div>
                    {selectedAttachments.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2">
                        {selectedAttachments.map((fileUrl, index) => (
                          <a
                            key={`${fileUrl}-${index}`}
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between rounded-xl border border-border bg-muted/50 px-3 py-3 text-sm text-sky-700 transition-colors hover:border-sky-200 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/30"
                          >
                            <span className="inline-flex items-center gap-2">
                              <Paperclip className="h-4 w-4 shrink-0" />
                              Arquivo {index + 1}
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0" />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border bg-muted/50 px-4 py-4 text-sm text-muted-foreground">
                        Nenhum arquivo adicional enviado.
                      </div>
                    )}
                  </section>
                </div>
              </div>

              <SheetFooter className="border-t border-border px-6 py-4">
                <Button variant="outline" onClick={() => setSelectedPatientId(null)}>
                  Fechar
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => onAccept(selectedPatient)}
                  disabled={accepting}
                >
                  {accepting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Video className="mr-2 h-4 w-4" />}
                  Aceitar e continuar
                </Button>
              </SheetFooter>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
