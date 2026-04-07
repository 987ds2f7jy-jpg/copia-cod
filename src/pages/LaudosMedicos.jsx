import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { base44 } from '@/api/base44Client';
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
  Shield,
  Upload,
  User,
  ClipboardList,
  Stethoscope,
  X,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const TIPOS_LAUDO = [
  'Afastamento médico',
  'Laudo para doença e INSS',
  'Academia',
  'Trabalho / emprego',
  'Escola',
  'Cirurgia',
  'Uso contínuo de medicação',
  'Viagem',
  'Judicial',
  'Outros',
];

const STEPS = [
  { label: 'Identificação', icon: User },
  { label: 'Saúde', icon: Stethoscope },
  { label: 'Laudo', icon: FileText },
  { label: 'Documentos', icon: Upload },
];

function FilePreview({ file, onRemove }) {
  const [preview, setPreview] = useState('');

  useEffect(() => {
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
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
      {onRemove && (
        <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default function LaudosMedicos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Step 1 – Identification (auto-filled)
  const [nome, setNome] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');

  // Step 2 – Health
  const [diagnostico, setDiagnostico] = useState('');
  const [historico, setHistorico] = useState('');
  const [doencasCronicas, setDoencasCronicas] = useState('');
  const [alergias, setAlergias] = useState('');
  const [medicamentos, setMedicamentos] = useState('');

  // Step 3 – Laudo type
  const [tipoLaudo, setTipoLaudo] = useState('');
  const [finalidade, setFinalidade] = useState('');

  // Step 4 – Files
  const [docIdentidade, setDocIdentidade] = useState(null);
  const [examesRecentes, setExamesRecentes] = useState([]);
  const [relatorios, setRelatorios] = useState([]);

  useEffect(() => {
    if (user) {
      setNome(user.full_name || '');
      setNascimento(user.birth_date || '');
      setCpf(user.cpf || '');
      setTelefone(user.phone || '');
      setEmail(user.email || '');
    }
  }, [user]);

  function canAdvance() {
    if (step === 0) return nome && nascimento && cpf && telefone && email;
    if (step === 1) return diagnostico.trim();
    if (step === 2) return tipoLaudo && finalidade.trim();
    if (step === 3) return !!docIdentidade;
    return false;
  }

  async function uploadFile(file, folder) {
    const ext = file.name.split('.').pop();
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('uploads').upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from('uploads').getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit() {
    if (!user?.id) {
      toast({ title: 'Erro', description: 'É necessário estar logado.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Upload all files
      const docUrl = await uploadFile(docIdentidade, 'laudos');
      const examesUrls = await Promise.all(examesRecentes.map((f) => uploadFile(f, 'laudos')));
      const relatoriosUrls = await Promise.all(relatorios.map((f) => uploadFile(f, 'laudos')));

      const allUrls = [docUrl, ...examesUrls, ...relatoriosUrls];

      // Create solicitacao
      await base44.entities.SolicitacaoExame.create({
        paciente_id: user.id,
        paciente_nome: nome,
        paciente_email: email,
        paciente_telefone: telefone,
        tipo: 'laudo_medico',
        exame_solicitado: '',
        motivo: finalidade,
        sintomas: diagnostico,
        status: 'pending',
        assintomatico_confirmado: false,
        dados_saude: {
          diagnostico,
          historico,
          doencas_cronicas: doencasCronicas,
          alergias,
          medicamentos,
        },
        especificacao_laudo: {
          tipo_laudo: tipoLaudo,
          finalidade,
        },
        arquivos_urls: allUrls,
      });

      // Add patient to queue for Clínico Geral
      await base44.entities.Queue.create({
        patient_id: user.id,
        patient_name: nome,
        patient_email: email,
        specialty: 'clinico_geral',
        symptoms: `[Laudo Médico: ${tipoLaudo}] ${diagnostico}`,
        status: 'waiting',
        priority_level: 'normal',
      });

      setSuccess(true);
      toast({ title: 'Solicitação enviada!', description: 'Você foi adicionado à fila de atendimento.' });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Erro ao enviar',
        description: err?.message || 'Tente novamente.',
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
            <h2 className="text-xl font-bold">Solicitação Enviada!</h2>
            <p className="text-muted-foreground text-sm">
              Você foi adicionado à fila de atendimento de Clínico Geral. Aguarde ser chamado pelo médico.
            </p>
            <Button className="w-full" onClick={() => navigate('/ConsultaAgora')}>
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
            <h1 className="text-2xl font-bold">Laudos Médicos</h1>
            <p className="text-muted-foreground text-sm">
              Emissão digital de laudos médicos com assinatura eletrônica certificada e envio imediato para afastamento, INSS, trabalho, escola, viagem e outros.
            </p>
          </div>

          <Card className="border-orange-300 bg-orange-50">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-orange-700 font-semibold">
                <AlertTriangle className="w-5 h-5" />
                <span>Avisos Importantes</span>
              </div>

              <div className="space-y-3 text-sm text-orange-900">
                <div className="flex gap-2">
                  <span>👨‍⚕️</span>
                  <div><strong>Autonomia médica</strong><br />O médico possui total autonomia para negar, alterar ou complementar o laudo caso considere necessário.</div>
                </div>
                <div className="flex gap-2">
                  <span>🛡️</span>
                  <div><strong>Sua responsabilidade</strong><br />Você é responsável pela veracidade e completude de todas as informações fornecidas. Informações falsas ou incompletas podem invalidar o laudo.</div>
                </div>
                <div className="flex gap-2">
                  <span>📋</span>
                  <div><strong>Documentos obrigatórios</strong><br />É obrigatório anexar documento de identidade legível. Laudos sem documentação comprobatória não serão emitidos.</div>
                </div>
                <div className="flex gap-2">
                  <span>⚠️</span>
                  <div><strong>Atendimento</strong><br />Este serviço é realizado exclusivamente por Clínico Geral via fila de plantão.</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" size="lg" onClick={() => setAccepted(true)}>
            <CheckCircle className="w-5 h-5 mr-2" />
            Confirmo que entendi os avisos e desejo prosseguir
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <h1 className="text-2xl font-bold text-center">Laudos Médicos</h1>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === step;
              const isDone = i < step;
              return (
                <div key={i} className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {isDone ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={`text-xs mt-1 ${isActive ? 'font-semibold' : 'text-muted-foreground'}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
          <Progress value={((step + 1) / STEPS.length) * 100} className="h-2" />
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            {/* Step 0 – Identification */}
            {step === 0 && (
              <>
                <h2 className="font-semibold text-lg flex items-center gap-2"><User className="w-5 h-5" /> Identificação</h2>
                <div className="space-y-3">
                  <div><Label>Nome completo *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
                  <div><Label>Data de nascimento *</Label><Input value={nascimento} onChange={(e) => setNascimento(e.target.value)} placeholder="DD/MM/AAAA" /></div>
                  <div><Label>CPF *</Label><Input value={cpf} onChange={(e) => setCpf(e.target.value)} /></div>
                  <div><Label>Telefone *</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
                  <div><Label>E-mail *</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></div>
                </div>
              </>
            )}

            {/* Step 1 – Health */}
            {step === 1 && (
              <>
                <h2 className="font-semibold text-lg flex items-center gap-2"><Stethoscope className="w-5 h-5" /> Informações de Saúde</h2>
                <div className="space-y-3">
                  <div><Label>Diagnóstico atual ou motivo do laudo *</Label><Textarea value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} rows={3} /></div>
                  <div><Label>Histórico clínico relevante</Label><Textarea value={historico} onChange={(e) => setHistorico(e.target.value)} rows={2} /></div>
                  <div><Label>Doenças crônicas</Label><Textarea value={doencasCronicas} onChange={(e) => setDoencasCronicas(e.target.value)} rows={2} /></div>
                  <div><Label>Alergias</Label><Textarea value={alergias} onChange={(e) => setAlergias(e.target.value)} rows={2} /></div>
                  <div><Label>Medicamentos em uso</Label><Textarea value={medicamentos} onChange={(e) => setMedicamentos(e.target.value)} rows={2} /></div>
                </div>
              </>
            )}

            {/* Step 2 – Laudo type */}
            {step === 2 && (
              <>
                <h2 className="font-semibold text-lg flex items-center gap-2"><FileText className="w-5 h-5" /> Especificação do Laudo</h2>
                <div className="space-y-3">
                  <div>
                    <Label>Tipo de laudo solicitado *</Label>
                    <Select value={tipoLaudo} onValueChange={setTipoLaudo}>
                      <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_LAUDO.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Finalidade do laudo *</Label><Textarea value={finalidade} onChange={(e) => setFinalidade(e.target.value)} rows={3} placeholder="Descreva a finalidade do laudo..." /></div>
                </div>
              </>
            )}

            {/* Step 3 – Documents */}
            {step === 3 && (
              <>
                <h2 className="font-semibold text-lg flex items-center gap-2"><Upload className="w-5 h-5" /> Documentos de Apoio</h2>
                <div className="space-y-4">
                  <div>
                    <Label>Documento de identidade * (PDF, JPG, PNG – máx. 10MB)</Label>
                    <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setDocIdentidade(e.target.files?.[0] || null)} className="mt-1" />
                    {docIdentidade && <div className="mt-2"><FilePreview file={docIdentidade} onRemove={() => setDocIdentidade(null)} /></div>}
                  </div>
                  <div>
                    <Label>Exames recentes (opcional – múltiplos arquivos)</Label>
                    <Input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={(e) => setExamesRecentes(Array.from(e.target.files || []))} className="mt-1" />
                    {examesRecentes.length > 0 && (
                      <div className="mt-2 space-y-2">{examesRecentes.map((f, i) => <FilePreview key={i} file={f} />)}</div>
                    )}
                  </div>
                  <div>
                    <Label>Relatórios médicos (opcional – múltiplos arquivos)</Label>
                    <Input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={(e) => setRelatorios(Array.from(e.target.files || []))} className="mt-1" />
                    {relatorios.length > 0 && (
                      <div className="mt-2 space-y-2">{relatorios.map((f, i) => <FilePreview key={i} file={f} />)}</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 0 && (
            <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Anterior
            </Button>
          )}
          {step < 3 ? (
            <Button className="flex-1" disabled={!canAdvance()} onClick={() => setStep(step + 1)}>
              Próxima <ArrowRight className="w-4 h-4 ml-2" />
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
