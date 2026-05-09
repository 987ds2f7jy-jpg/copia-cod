import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/components/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle, Loader2, Search } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { quoteServicePricingRequest } from '@/client-api/pricing';
import { formatMoney } from '@/client-api/payments';
import PaymentStep from '@/components/payments/PaymentStep';
import {
  buildSpecificExamSymptoms,
  createCheckupRequest,
  createSpecificExamRequest,
  persistSpecificExamRedirect,
} from '@/lib/solicitacoesExames';

function SolicitacaoExamesInner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [checkupOpen, setCheckupOpen] = useState(false);
  const [checkupConfirmed, setCheckupConfirmed] = useState(false);
  const [checkupLoading, setCheckupLoading] = useState(false);
  const [pendingCheckup, setPendingCheckup] = useState(null);
  const [especificosOpen, setEspecificosOpen] = useState(false);
  const [exame, setExame] = useState('');
  const [motivo, setMotivo] = useState('');
  const [sintomas, setSintomas] = useState('');
  const [especificosLoading, setEspecificosLoading] = useState(false);
  const [pendingEspecificos, setPendingEspecificos] = useState(null);
  const canQuotePatientService = Boolean(user?.id) && user?.role === 'patient';

  const { data: checkupQuote, isLoading: checkupQuoteLoading, error: checkupQuoteError } = useQuery({
    queryKey: ['service-pricing', 'solicitacao-exame', 'checkup'],
    queryFn: () => quoteServicePricingRequest({
      flow: 'solicitacao_exame',
      tipo: 'checkup',
    }),
    enabled: canQuotePatientService && checkupOpen,
    retry: false,
    meta: { handledError: true, severity: 'warn' },
  });

  const { data: especificosQuote, isLoading: especificosQuoteLoading, error: especificosQuoteError } = useQuery({
    queryKey: ['service-pricing', 'solicitacao-exame', 'especificos'],
    queryFn: () => quoteServicePricingRequest({
      flow: 'solicitacao_exame',
      tipo: 'especificos',
    }),
    enabled: canQuotePatientService && especificosOpen,
    retry: false,
    meta: { handledError: true, severity: 'warn' },
  });

  async function handleCheckupSubmit() {
    if (!checkupConfirmed) {
      return;
    }

    setCheckupLoading(true);

    try {
      const solicitacao = await createCheckupRequest(user);
      setPendingCheckup(solicitacao);
      toast({
        title: 'Solicitacao criada',
        description: 'Finalize o pagamento para liberar o pedido de Check-Up.',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Nao foi possivel enviar a solicitacao.',
        variant: 'destructive',
      });
    } finally {
      setCheckupLoading(false);
    }
  }

  async function handleEspecificosSubmit() {
    if (!exame.trim()) {
      return;
    }

    setEspecificosLoading(true);

    try {
      const solicitacao = await createSpecificExamRequest(user, {
        exame: exame.trim(),
        motivo: motivo.trim(),
        sintomas: sintomas.trim(),
      });

      const sintomasCompletos = buildSpecificExamSymptoms({
        exame: exame.trim(),
        motivo: motivo.trim(),
        sintomas: sintomas.trim(),
      });

      setPendingEspecificos({
        solicitacao,
        redirect: {
        especialidade: 'clinico_geral',
        sintomas: sintomasCompletos,
        exame: exame.trim(),
        motivo: motivo.trim(),
        descricao_original_sintomas: sintomas.trim(),
        solicitacaoExameId: solicitacao.id,
        },
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Nao foi possivel enviar a solicitacao.',
        variant: 'destructive',
      });
    } finally {
      setEspecificosLoading(false);
    }
  }

  function finishCheckupPayment() {
    toast({
      title: 'Pagamento confirmado',
      description: 'Seu pedido de Check-Up foi liberado para avaliacao.',
    });
    setPendingCheckup(null);
    setCheckupOpen(false);
    setCheckupConfirmed(false);
  }

  function finishEspecificosPayment() {
    const redirect = pendingEspecificos?.redirect;

    if (!redirect) {
      return;
    }

    persistSpecificExamRedirect(redirect);
    setPendingEspecificos(null);
    setEspecificosOpen(false);
    navigate(`/ConsultaAgora?especialidade=${encodeURIComponent('clinico_geral')}&sintomas=${encodeURIComponent(redirect.sintomas)}`);
  }

  return (
    <div className="min-h-screen bg-background py-12 text-foreground">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-3">Solicitacao de Exames</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Peca exames laboratoriais e de imagem com orientacao medica rapida e digital.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <Card
            className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-2 border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/30"
            onClick={() => setCheckupOpen(true)}
          >
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-5 dark:bg-emerald-500/15">
                <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-300" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Check-Up</h3>
              <p className="text-sm text-muted-foreground">Pacote de exames essenciais de rotina.</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-2 border-blue-200 bg-blue-50/50 dark:border-blue-900/60 dark:bg-blue-950/30"
            onClick={() => setEspecificosOpen(true)}
          >
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-5 dark:bg-blue-500/15">
                <Search className="w-8 h-8 text-blue-600 dark:text-blue-300" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Exames Especificos</h3>
              <p className="text-sm text-muted-foreground">Solicite exames com orientacao medica e siga para o plantao.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={checkupOpen} onOpenChange={setCheckupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirmacao de Check-Up
            </DialogTitle>
            <DialogDescription>Leia com atencao antes de prosseguir.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {pendingCheckup ? (
              <PaymentStep
                payment={pendingCheckup.payment || pendingCheckup}
                ownerType="solicitacao_exame"
                ownerId={pendingCheckup.id}
                title="Pagamento do Check-Up"
                description="O pedido foi criado, mas so sera liberado apos pagamento confirmado."
                paidTitle="Pagamento confirmado"
                paidDescription="Seu Check-Up foi liberado para avaliacao."
                continueLabel="Concluir"
                successRedirectPath="/DashboardPaciente"
                failureRedirectPath="/SolicitacaoExames"
                onPaid={finishCheckupPayment}
                onContinue={finishCheckupPayment}
              />
            ) : (
            <>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 space-y-2 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
              <p className="font-semibold">Atencao:</p>
              <p>Esta modalidade e exclusiva para pacientes assintomaticos no momento.</p>
              <p>Ela e indicada apenas para exames de rotina e check-up preventivo.</p>
              <p>
                Se voce estiver com dor, febre ou qualquer sintoma, use a opcao Exames Especificos para seguir ao plantao.
              </p>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg">
              <Checkbox
                id="assintomatico"
                checked={checkupConfirmed}
                onCheckedChange={(value) => setCheckupConfirmed(Boolean(value))}
                className="mt-0.5"
              />
              <label htmlFor="assintomatico" className="text-sm text-foreground cursor-pointer leading-snug">
                Li e confirmo que estou assintomatico no momento.
              </label>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/40">
              <div className="flex items-center justify-between">
                <span className="text-emerald-700 dark:text-emerald-300">Valor oficial</span>
                <span className="font-bold text-emerald-800 dark:text-emerald-200">
                  {checkupQuoteLoading
                    ? 'Carregando...'
                    : checkupQuote?.grossPrice
                    ? formatMoney(checkupQuote.grossPrice)
                    : 'A definir'}
                </span>
              </div>
              {checkupQuoteError && (
                <p className="mt-2 text-red-600 dark:text-red-300">
                  {checkupQuoteError.message || 'Nao foi possivel carregar o valor oficial.'}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setCheckupOpen(false);
                  setCheckupConfirmed(false);
                }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={!checkupConfirmed || checkupLoading || checkupQuoteLoading || Boolean(checkupQuoteError)}
                onClick={handleCheckupSubmit}
              >
                {checkupLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Confirmar e Enviar
              </Button>
            </div>
            </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={especificosOpen} onOpenChange={setEspecificosOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Exames Especificos</DialogTitle>
            <DialogDescription>Preencha os dados para solicitar o exame e seguir para o plantao.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {pendingEspecificos?.solicitacao ? (
              <PaymentStep
                payment={pendingEspecificos.solicitacao.payment || pendingEspecificos.solicitacao}
                ownerType="solicitacao_exame"
                ownerId={pendingEspecificos.solicitacao.id}
                title="Pagamento dos exames especificos"
                description="Pague esta solicitacao para liberar o encaminhamento ao plantao."
                paidTitle="Pagamento confirmado"
                paidDescription="Agora vamos levar voce para o plantao."
                continueLabel="Seguir para o plantao"
                successRedirectPath={`/ConsultaAgora?especialidade=${encodeURIComponent('clinico_geral')}&sintomas=${encodeURIComponent(pendingEspecificos.redirect?.sintomas || '')}`}
                failureRedirectPath="/SolicitacaoExames"
                onBeforeCheckout={() => {
                  if (pendingEspecificos?.redirect) {
                    persistSpecificExamRedirect(pendingEspecificos.redirect);
                  }
                }}
                onPaid={finishEspecificosPayment}
                onContinue={finishEspecificosPayment}
              />
            ) : (
            <>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Qual exame voce deseja solicitar?</label>
              <Input
                value={exame}
                onChange={(event) => setExame(event.target.value)}
                placeholder="Ex: Hemograma, Raio-X de torax..."
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Por que voce deseja solicitar este exame?</label>
              <Textarea
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                placeholder="Motivo da solicitacao..."
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Descreva seus sintomas ou a situacao de saude</label>
              <Textarea
                value={sintomas}
                onChange={(event) => setSintomas(event.target.value)}
                placeholder="Descreva seus sintomas..."
              />
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm dark:border-blue-900/60 dark:bg-blue-950/40">
              <div className="flex items-center justify-between">
                <span className="text-blue-700 dark:text-blue-300">Valor oficial</span>
                <span className="font-bold text-blue-800 dark:text-blue-200">
                  {especificosQuoteLoading
                    ? 'Carregando...'
                    : especificosQuote?.grossPrice
                    ? formatMoney(especificosQuote.grossPrice)
                    : 'A definir'}
                </span>
              </div>
              {especificosQuoteError && (
                <p className="mt-2 text-red-600 dark:text-red-300">
                  {especificosQuoteError.message || 'Nao foi possivel carregar o valor oficial.'}
                </p>
              )}
            </div>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!exame.trim() || especificosLoading || especificosQuoteLoading || Boolean(especificosQuoteError)}
              onClick={handleEspecificosSubmit}
            >
              {especificosLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Solicitar ao Medico
            </Button>
            </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SolicitacaoExames() {
  return (
    <ProtectedRoute>
      <SolicitacaoExamesInner />
    </ProtectedRoute>
  );
}
