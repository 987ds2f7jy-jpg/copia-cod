import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { deleteUploadedFiles, uploadFile } from '@/client-api/uploads';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  Loader2,
  Shield,
  Upload,
  UserRound,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { createPrescriptionRenewalRequest } from '@/lib/solicitacoesExames';
import { quoteServicePricingRequest } from '@/client-api/pricing';
import { formatMoney } from '@/client-api/payments';
import PaymentStep from '@/components/payments/PaymentStep';

const FREQUENCIAS = [
  '1x ao dia',
  '2x ao dia',
  '3x ao dia',
  '4x ao dia',
  '5x ao dia',
  '6x ao dia',
];

export default function RenovacaoReceitas() {
  return (
    <ProtectedRoute>
      <RenovacaoReceitasInner />
    </ProtectedRoute>
  );
}

function RenovacaoReceitasInner() {
  const { user } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [medicamento, setMedicamento] = useState('');
  const [dosagem, setDosagem] = useState('');
  const [frequencia, setFrequencia] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [pendingSolicitacao, setPendingSolicitacao] = useState(null);
  const canQuotePatientService = Boolean(user?.id) && user?.role === 'patient';

  const { data: serviceQuote, isLoading: quoteLoading, error: quoteError } = useQuery({
    queryKey: ['service-pricing', 'solicitacao-exame', 'renovacao_receitas'],
    queryFn: () => quoteServicePricingRequest({
      flow: 'solicitacao_exame',
      tipo: 'renovacao_receitas',
    }),
    enabled: canQuotePatientService && accepted && !success,
    retry: false,
    meta: { handledError: true, severity: 'warn' },
  });

  function getUserFacingErrorMessage(error) {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error?.message === 'string' && error.message) {
      return error.message;
    }

    return 'Nao foi possivel enviar a solicitacao.';
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setArquivo(file);

    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
      return;
    }

    setPreviewUrl('');
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!medicamento.trim() || !dosagem.trim() || !frequencia || !arquivo) {
      return;
    }

    setLoading(true);

    let uploadedFilePath = '';

    try {
      const uploadedFile = await uploadFile({
        file: arquivo,
        folder: 'renovacao_receitas',
      });
      uploadedFilePath = uploadedFile?.path || '';

      const solicitacao = await createPrescriptionRenewalRequest(user, {
        nomeMedicamento: medicamento.trim(),
        dosagem: dosagem.trim(),
        frequencia,
        arquivoReceitaUrl: uploadedFile?.path || '',
      });

      setPendingSolicitacao(solicitacao);
      toast({
        title: 'Solicitacao criada',
        description: 'Finalize o pagamento para liberar a analise medica.',
      });
    } catch (error) {
      console.error('[RenovacaoReceitas] Falha ao enviar solicitacao', error);

      if (uploadedFilePath) {
        await deleteUploadedFiles({ paths: [uploadedFilePath] }).catch(() => {});
      }

      toast({
        title: 'Erro',
        description: getUserFacingErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  const formValid = medicamento.trim() && dosagem.trim() && frequencia && arquivo;

  function finishPayment() {
    setSuccess(true);
    setPendingSolicitacao(null);
    toast({
      title: 'Pagamento confirmado',
      description: 'Seu pedido de renovacao foi liberado para analise medica.',
    });
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="max-w-lg mx-auto px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">Solicitacao Enviada!</h2>
          <p className="text-muted-foreground mb-6">
            Seu pedido de renovacao de receita foi enviado para analise medica. Voce sera notificado quando houver resposta.
          </p>
          <Button onClick={() => window.history.back()} variant="outline">Voltar</Button>
        </div>
      </div>
    );
  }

  if (pendingSolicitacao) {
    return (
      <div className="min-h-screen bg-background py-12 text-foreground">
        <div className="max-w-lg mx-auto px-4">
          <PaymentStep
            payment={pendingSolicitacao.payment || pendingSolicitacao}
            ownerType="solicitacao_exame"
            ownerId={pendingSolicitacao.id}
            title="Pagamento da renovacao"
            description="Sua solicitacao foi criada, mas so seguira para analise apos pagamento confirmado."
            paidTitle="Pagamento confirmado"
            paidDescription="A renovacao foi liberada para analise medica."
            continueLabel="Concluir"
            successRedirectPath="/DashboardPaciente"
            failureRedirectPath="/RenovacaoReceitas"
            onPaid={finishPayment}
            onContinue={finishPayment}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 text-foreground">
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-3">Renovacao de Receitas</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Renove suas receitas de medicamentos de uso continuo de forma rapida e digital, com envio direto ao medico.
          </p>
        </div>

        {!accepted ? (
          <Card className="border-border shadow-md">
            <CardContent className="p-6 space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Medicamentos nao renovados</p>
                    <p>Nao renovamos medicamentos tarja preta, antibioticos e terapias hormonais com esteroides androgenicos e anabolizantes.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ClipboardList className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Documentacao obrigatoria</p>
                    <p>E obrigatorio anexar a prescricao anterior de forma legivel para analise medica.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <UserRound className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Autonomia medica</p>
                    <p>O medico possui total autonomia para negar o pedido caso considere necessario.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Sua responsabilidade</p>
                    <p>Voce e responsavel pela veracidade das informacoes fornecidas ao medico.</p>
                  </div>
                </div>
              </div>

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-base"
                onClick={() => setAccepted(true)}
              >
                Confirmo que entendi as regras e desejo prosseguir com a renovacao
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border shadow-md">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="medicamento">Nome do medicamento ou composto ativo *</Label>
                  <Input
                    id="medicamento"
                    value={medicamento}
                    onChange={(event) => setMedicamento(event.target.value)}
                    placeholder="Ex: Losartana, Metformina..."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dosagem">Dosagem do medicamento *</Label>
                  <Input
                    id="dosagem"
                    value={dosagem}
                    onChange={(event) => setDosagem(event.target.value)}
                    placeholder="Ex: 500mg, 1 comprimido..."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Frequencia de uso *</Label>
                  <Select value={frequencia} onValueChange={setFrequencia}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a frequencia" />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIAS.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="arquivo">Upload da ultima receita *</Label>
                  <div
                    className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-emerald-400 transition-colors cursor-pointer"
                    onClick={() => document.getElementById('arquivo')?.click()}
                  >
                    <input
                      type="file"
                      id="arquivo"
                      accept="image/jpeg,image/png,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {arquivo ? (
                      <div className="space-y-3">
                        {previewUrl && (
                          <img src={previewUrl} alt="Preview" className="max-h-48 mx-auto rounded-lg" />
                        )}
                        <p className="text-sm text-foreground font-medium">{arquivo.name}</p>
                        <p className="text-xs text-muted-foreground">Clique para trocar o arquivo</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
                        <p className="text-sm text-muted-foreground">Clique para enviar JPG, PNG ou PDF</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/40">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-700 dark:text-emerald-300">Valor oficial</span>
                    <span className="font-bold text-emerald-800 dark:text-emerald-200">
                      {quoteLoading
                        ? 'Carregando...'
                        : serviceQuote?.grossPrice
                        ? formatMoney(serviceQuote.grossPrice)
                        : 'A definir'}
                    </span>
                  </div>
                  {quoteError && (
                    <p className="mt-2 text-red-600 dark:text-red-300">
                      {quoteError.message || 'Nao foi possivel carregar o valor oficial.'}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-5 text-base"
                  disabled={!formValid || loading || quoteLoading || Boolean(quoteError)}
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Enviar Solicitacao de Renovacao
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
