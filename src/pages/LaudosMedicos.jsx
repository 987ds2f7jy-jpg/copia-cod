import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { supabase } from '@/integrations/supabase/client';
import { base44 } from '@/api/base44Client';
import { leaveQueueEntry } from '@/client-api/queues';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  FileText,
  Loader2,
  Upload,
  User,
  Stethoscope,
  X,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import {
  clearLaudoWizardState,
  createLaudoMedicoRequest,
  createLaudoQueueEntry,
  linkSolicitacaoExameToQueue,
  persistLaudoWizardState,
  readLaudoWizardState,
  validateMedicalSupportFile,
  validateMedicalSupportFiles,
} from '@/lib/solicitacoesExames';

const TIPOS_LAUDO = [
  'Afastamento medico',
  'Laudo para doenca e INSS',
  'Academia',
  'Trabalho / emprego',
  'Escola',
  'Cirurgia',
  'Uso continuo de medicacao',
  'Viagem',
  'Judicial',
  'Outros',
];

const STEPS = [
  { label: 'Identificacao', icon: User },
  { label: 'Saude', icon: Stethoscope },
  { label: 'Laudo', icon: FileText },
  { label: 'Documentos', icon: Upload },
];

function FilePreview({ file, onRemove }) {
  const [preview, setPreview] = useState('');

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreview('');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [file]);

  return (
    <div className="flex items-center gap-3 bg-muted rounded-lg p-3">
      {preview ? (
        <img src={preview} alt={file.name} className="w-12 h-12 object-cover rounded" />
      ) : (
        <FileText className="w-8 h-8 text-muted-foreground" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
      </div>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="w-4 h-4" />
        </button>
      ) : null}
    </div>
  );
}

function getSafeFileExtension(file) {
  const extension = file?.name?.includes('.') ? file.name.split('.').pop().toLowerCase() : 'bin';
  return extension.replace(/[^a-z0-9]/g, '') || 'bin';
}

function buildUploadPath(userId, folderName, file) {
  const extension = getSafeFileExtension(file);
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `laudos/${userId}/${folderName}/${Date.now()}_${randomSuffix}.${extension}`;
}

function getErrorMessage(error, fallbackMessage) {
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallbackMessage;
}

function LaudosMedicosInner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const hydrationRef = useRef(false);

  const [accepted, setAccepted] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [nome, setNome] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');

  const [diagnostico, setDiagnostico] = useState('');
  const [historico, setHistorico] = useState('');
  const [doencasCronicas, setDoencasCronicas] = useState('');
  const [alergias, setAlergias] = useState('');
  const [medicamentos, setMedicamentos] = useState('');

  const [tipoLaudo, setTipoLaudo] = useState('');
  const [finalidade, setFinalidade] = useState('');

  const [docIdentidade, setDocIdentidade] = useState(null);
  const [examesRecentes, setExamesRecentes] = useState([]);
  const [relatorios, setRelatorios] = useState([]);

  useEffect(() => {
    if (!user || hydrationRef.current) {
      return;
    }

    hydrationRef.current = true;
    const persistedState = readLaudoWizardState() || {};

    setAccepted(Boolean(persistedState.accepted));
    setStep(
      Number.isInteger(persistedState.step)
        ? Math.max(0, Math.min(STEPS.length - 1, persistedState.step))
        : 0,
    );

    setNome(persistedState.nome || user.full_name || '');
    setNascimento(persistedState.nascimento || user.birth_date || '');
    setCpf(persistedState.cpf || user.cpf || '');
    setTelefone(persistedState.telefone || user.phone || '');
    setEmail(persistedState.email || user.email || '');

    setDiagnostico(persistedState.diagnostico || '');
    setHistorico(persistedState.historico || '');
    setDoencasCronicas(persistedState.doencasCronicas || '');
    setAlergias(persistedState.alergias || '');
    setMedicamentos(persistedState.medicamentos || '');

    setTipoLaudo(persistedState.tipoLaudo || '');
    setFinalidade(persistedState.finalidade || '');
  }, [user]);

  useEffect(() => {
    if (!hydrationRef.current || success) {
      return;
    }

    persistLaudoWizardState({
      accepted,
      step,
      nome,
      nascimento,
      cpf,
      telefone,
      email,
      diagnostico,
      historico,
      doencasCronicas,
      alergias,
      medicamentos,
      tipoLaudo,
      finalidade,
    });
  }, [
    accepted,
    step,
    nome,
    nascimento,
    cpf,
    telefone,
    email,
    diagnostico,
    historico,
    doencasCronicas,
    alergias,
    medicamentos,
    tipoLaudo,
    finalidade,
    success,
  ]);

  function canAdvance() {
    if (step === 0) {
      return Boolean(nome && nascimento && cpf && telefone && email);
    }

    if (step === 1) {
      return Boolean(diagnostico.trim());
    }

    if (step === 2) {
      return Boolean(tipoLaudo && finalidade.trim());
    }

    if (step === 3) {
      return Boolean(docIdentidade);
    }

    return false;
  }

  function validateUploadGroups() {
    const docError = validateMedicalSupportFile(docIdentidade, { required: true });

    if (docError) {
      return docError;
    }

    const examesError = validateMedicalSupportFiles(examesRecentes, { maxCount: 5 });
    if (examesError) {
      return examesError;
    }

    const relatoriosError = validateMedicalSupportFiles(relatorios, { maxCount: 5 });
    if (relatoriosError) {
      return relatoriosError;
    }

    return null;
  }

  function handleSingleFileChange(file, setter) {
    const errorMessage = validateMedicalSupportFile(file, { required: true });

    if (errorMessage) {
      toast({
        title: 'Arquivo invalido',
        description: errorMessage,
        variant: 'destructive',
      });
      return;
    }

    setter(file);
  }

  function handleMultipleFilesChange(fileList, setter, label) {
    const nextFiles = Array.from(fileList || []);
    const errorMessage = validateMedicalSupportFiles(nextFiles, { maxCount: 5 });

    if (errorMessage) {
      toast({
        title: `Arquivos invalidos em ${label}`,
        description: errorMessage,
        variant: 'destructive',
      });
      return;
    }

    setter(nextFiles);
  }

  async function uploadFile(file, folderName) {
    const storagePath = buildUploadPath(user.id, folderName, file);
    const { error } = await supabase.storage.from('uploads').upload(storagePath, file);

    if (error) {
      throw error;
    }

    const { data } = supabase.storage.from('uploads').getPublicUrl(storagePath);

    return {
      path: storagePath,
      publicUrl: data.publicUrl,
      fileName: file.name,
    };
  }

  async function removeUploadedFiles(uploadedFiles) {
    const uniquePaths = Array.from(
      new Set((uploadedFiles || []).map((file) => file?.path).filter(Boolean)),
    );

    if (uniquePaths.length === 0) {
      return;
    }

    const { error } = await supabase.storage.from('uploads').remove(uniquePaths);

    if (error) {
      console.error('[laudos-medicos] cleanup upload failed', error);
    }
  }

  async function handleSubmit() {
    if (!user?.id) {
      toast({
        title: 'Erro',
        description: 'E necessario estar logado para continuar.',
        variant: 'destructive',
      });
      return;
    }

    const uploadValidationError = validateUploadGroups();

    if (uploadValidationError) {
      toast({
        title: 'Documentos invalidos',
        description: uploadValidationError,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    let uploadedFiles = [];
    let createdSolicitacao = null;
    let createdQueueEntry = null;
    let reusedExistingQueue = false;

    try {
      const [docUpload, examesUploads, relatoriosUploads] = await Promise.all([
        uploadFile(docIdentidade, 'documento_identidade'),
        Promise.all(examesRecentes.map((file) => uploadFile(file, 'exames'))),
        Promise.all(relatorios.map((file) => uploadFile(file, 'relatorios'))),
      ]);

      uploadedFiles = [docUpload, ...examesUploads, ...relatoriosUploads];
      const arquivosUrls = uploadedFiles.map((file) => file.publicUrl);

      createdSolicitacao = await createLaudoMedicoRequest(user, {
        dadosIdentificacao: {
          nome_completo: nome,
          data_nascimento: nascimento,
          cpf,
          telefone,
          email,
        },
        informacoesSaude: {
          diagnostico,
          historico,
          doencas_cronicas: doencasCronicas,
          alergias,
          medicamentos,
        },
        especificacaoLaudo: {
          tipo_laudo: tipoLaudo,
          finalidade,
        },
        arquivos: arquivosUrls,
      });

      const queueResult = await createLaudoQueueEntry({
        patientId: user.id,
        patientName: nome,
        patientEmail: email,
        tipoLaudo,
        diagnostico,
        finalidade,
        solicitacaoExameId: createdSolicitacao.id,
      });

      createdQueueEntry = queueResult.entry;
      reusedExistingQueue = Boolean(queueResult.reusedExisting);

      await linkSolicitacaoExameToQueue(createdSolicitacao.id, createdQueueEntry?.id);

      clearLaudoWizardState();
      setSuccess(true);

      toast({
        title: 'Solicitacao enviada!',
        description: 'Voce foi direcionado para a fila de Clinico Geral.',
      });
    } catch (error) {
      console.error('[laudos-medicos] submit failed', error);

      if (createdSolicitacao?.id) {
        try {
          await base44.entities.SolicitacaoExame.delete(createdSolicitacao.id);
        } catch (cleanupError) {
          console.error('[laudos-medicos] cleanup solicitacao failed', cleanupError);
        }
      }

      if (createdQueueEntry?.id && !reusedExistingQueue) {
        try {
          await leaveQueueEntry({ queueId: createdQueueEntry.id });
        } catch (cleanupError) {
          console.error('[laudos-medicos] cleanup queue failed', cleanupError);
        }
      }

      await removeUploadedFiles(uploadedFiles);

      toast({
        title: 'Erro ao enviar',
        description: getErrorMessage(error, 'Nao foi possivel concluir a solicitacao de laudo.'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
            <h2 className="text-xl font-bold">Solicitacao enviada!</h2>
            <p className="text-muted-foreground text-sm">
              Seu laudo foi registrado e voce entrou na fila de Clinico Geral. Aguarde o profissional assumir o atendimento.
            </p>
            <Button className="w-full" onClick={() => navigate('/ConsultaAgora?specialty=clinico_geral')}>
              Ir para a Fila de Atendimento
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!accepted) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">Laudos Medicos</h1>
            <p className="text-muted-foreground text-sm">
              Emissao digital de laudos medicos com assinatura eletronica certificada e envio imediato para afastamento, INSS, trabalho, escola, viagem e outros.
            </p>
          </div>

          <Card className="border-orange-300 bg-orange-50">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-orange-700 font-semibold">
                <AlertTriangle className="w-5 h-5" />
                <span>Avisos importantes</span>
              </div>

              <div className="space-y-3 text-sm text-orange-900">
                <div>
                  <strong>Autonomia medica</strong>
                  <br />
                  O medico possui autonomia para negar, ajustar ou complementar o laudo quando julgar necessario.
                </div>
                <div>
                  <strong>Sua responsabilidade</strong>
                  <br />
                  Voce e responsavel pela veracidade das informacoes enviadas. Dados falsos ou incompletos podem impedir a emissao.
                </div>
                <div>
                  <strong>Documentacao obrigatoria</strong>
                  <br />
                  E obrigatorio anexar um documento de identidade legivel. Sem suporte documental o laudo nao segue para o medico.
                </div>
                <div>
                  <strong>Fluxo de atendimento</strong>
                  <br />
                  Este servico vai direto para a fila de plantao de Clinico Geral.
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            size="lg"
            onClick={() => setAccepted(true)}
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Confirmo que li os avisos e desejo prosseguir
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <h1 className="text-2xl font-bold text-center">Laudos Medicos</h1>

        <div className="space-y-2">
          <div className="flex justify-between">
            {STEPS.map((currentStep, index) => {
              const Icon = currentStep.icon;
              const isActive = index === step;
              const isDone = index < step;

              return (
                <div key={currentStep.label} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      isDone
                        ? 'bg-emerald-500 text-white'
                        : isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isDone ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={`text-xs mt-1 ${isActive ? 'font-semibold' : 'text-muted-foreground'}`}>
                    {currentStep.label}
                  </span>
                </div>
              );
            })}
          </div>
          <Progress value={((step + 1) / STEPS.length) * 100} className="h-2" />
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            {step === 0 ? (
              <>
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Identificacao
                </h2>
                <div className="space-y-3">
                  <div>
                    <Label>Nome completo *</Label>
                    <Input value={nome} onChange={(event) => setNome(event.target.value)} />
                  </div>
                  <div>
                    <Label>Data de nascimento *</Label>
                    <Input
                      value={nascimento}
                      onChange={(event) => setNascimento(event.target.value)}
                      placeholder="DD/MM/AAAA"
                    />
                  </div>
                  <div>
                    <Label>CPF *</Label>
                    <Input value={cpf} onChange={(event) => setCpf(event.target.value)} />
                  </div>
                  <div>
                    <Label>Telefone *</Label>
                    <Input value={telefone} onChange={(event) => setTelefone(event.target.value)} />
                  </div>
                  <div>
                    <Label>E-mail *</Label>
                    <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
                  </div>
                </div>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <Stethoscope className="w-5 h-5" />
                  Informacoes de Saude
                </h2>
                <div className="space-y-3">
                  <div>
                    <Label>Diagnostico atual ou motivo do laudo *</Label>
                    <Textarea value={diagnostico} onChange={(event) => setDiagnostico(event.target.value)} rows={3} />
                  </div>
                  <div>
                    <Label>Historico clinico relevante</Label>
                    <Textarea value={historico} onChange={(event) => setHistorico(event.target.value)} rows={2} />
                  </div>
                  <div>
                    <Label>Doencas cronicas</Label>
                    <Textarea
                      value={doencasCronicas}
                      onChange={(event) => setDoencasCronicas(event.target.value)}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label>Alergias</Label>
                    <Textarea value={alergias} onChange={(event) => setAlergias(event.target.value)} rows={2} />
                  </div>
                  <div>
                    <Label>Medicamentos em uso</Label>
                    <Textarea value={medicamentos} onChange={(event) => setMedicamentos(event.target.value)} rows={2} />
                  </div>
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Especificacao do Laudo
                </h2>
                <div className="space-y-3">
                  <div>
                    <Label>Tipo de laudo solicitado *</Label>
                    <Select value={tipoLaudo} onValueChange={setTipoLaudo}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_LAUDO.map((tipo) => (
                          <SelectItem key={tipo} value={tipo}>
                            {tipo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Finalidade do laudo *</Label>
                    <Textarea
                      value={finalidade}
                      onChange={(event) => setFinalidade(event.target.value)}
                      rows={3}
                      placeholder="Descreva a finalidade do laudo..."
                    />
                  </div>
                </div>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Documentos de Apoio
                </h2>
                <div className="space-y-4">
                  <div>
                    <Label>Documento de identidade * (PDF, JPG ou PNG - max. 10MB)</Label>
                    <Input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(event) => handleSingleFileChange(event.target.files?.[0] || null, setDocIdentidade)}
                      className="mt-1"
                    />
                    {docIdentidade ? (
                      <div className="mt-2">
                        <FilePreview file={docIdentidade} onRemove={() => setDocIdentidade(null)} />
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <Label>Exames recentes (opcional - ate 5 arquivos)</Label>
                    <Input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      multiple
                      onChange={(event) => handleMultipleFilesChange(event.target.files, setExamesRecentes, 'exames')}
                      className="mt-1"
                    />
                    {examesRecentes.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {examesRecentes.map((file, index) => (
                          <FilePreview
                            key={`${file.name}-${index}`}
                            file={file}
                            onRemove={() => setExamesRecentes((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <Label>Relatorios medicos (opcional - ate 5 arquivos)</Label>
                    <Input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      multiple
                      onChange={(event) => handleMultipleFilesChange(event.target.files, setRelatorios, 'relatorios')}
                      className="mt-1"
                    />
                    {relatorios.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {relatorios.map((file, index) => (
                          <FilePreview
                            key={`${file.name}-${index}`}
                            file={file}
                            onRemove={() => setRelatorios((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          {step > 0 ? (
            <Button variant="outline" className="flex-1" onClick={() => setStep((current) => current - 1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Anterior
            </Button>
          ) : null}

          {step < STEPS.length - 1 ? (
            <Button className="flex-1" disabled={!canAdvance()} onClick={() => setStep((current) => current + 1)}>
              Proxima
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!canAdvance() || loading}
              onClick={handleSubmit}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Continuar e iniciar consulta
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LaudosMedicos() {
  return (
    <ProtectedRoute>
      <LaudosMedicosInner />
    </ProtectedRoute>
  );
}
