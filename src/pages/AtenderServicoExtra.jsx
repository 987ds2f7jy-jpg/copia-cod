import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Loader2,
  Paperclip,
  Stethoscope,
  User,
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import NetAmountBadge from '@/components/dashboard/NetAmountBadge';
import {
  finishSolicitacaoExameAtendimentoRequest,
  getSolicitacaoExameAtendimentoRequest,
} from '@/client-api/solicitacoesExames';
import { createPageUrl } from '@/utils';
import { toast } from '@/components/ui/use-toast';

function formatDateTime(value) {
  if (!value) {
    return { date: 'Nao informado', time: '' };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { date: 'Nao informado', time: '' };
  }

  return {
    date: date.toLocaleDateString('pt-BR'),
    time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };
}

function formatAge(value) {
  if (!value) {
    return 'Nao informado';
  }

  const birthDate = new Date(value);

  if (Number.isNaN(birthDate.getTime())) {
    return 'Nao informado';
  }

  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDelta = now.getMonth() - birthDate.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age >= 0 ? `${age} anos` : 'Nao informado';
}

function formatSex(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'masculino') return 'Masculino';
  if (normalized === 'feminino') return 'Feminino';
  if (normalized) return 'Outro';
  return 'Nao informado';
}

function getServiceLabel(tipo) {
  return tipo === 'renovacao_receitas' ? 'Renovacao de receita' : 'Check-up';
}

function getStatusLabel(status) {
  if (status === 'in_progress') {
    return 'Em atendimento';
  }

  return status || 'Nao informado';
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function stringifyValue(value) {
  if (value === null || value === undefined || value === '') {
    return 'Nao informado';
  }

  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : 'Nao informado';
  }

  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${stringifyValue(item)}`)
      .join('\n') || 'Nao informado';
  }

  return String(value);
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{value || 'Nao informado'}</p>
    </div>
  );
}

function CheckupDetails({ solicitacao, patient }) {
  const informacoesSaude = normalizeObject(solicitacao.informacoes_saude);
  const dadosSaude = normalizeObject(solicitacao.dados_saude);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <DetailItem label="Motivo" value={solicitacao.motivo || 'Exames de rotina / check-up preventivo'} />
      <DetailItem label="Sintomas" value={solicitacao.sintomas} />
      <DetailItem label="Sexo" value={formatSex(patient?.sex)} />
      <DetailItem label="Idade" value={formatAge(patient?.birthDate)} />
      <DetailItem label="Informacoes de saude" value={stringifyValue(informacoesSaude)} />
      <DetailItem label="Dados adicionais" value={stringifyValue(dadosSaude)} />
    </div>
  );
}

function RenovacaoReceitaDetails({ solicitacao }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <DetailItem label="Medicamento" value={solicitacao.nome_medicamento} />
      <DetailItem label="Dosagem" value={solicitacao.dosagem} />
      <DetailItem label="Frequencia" value={solicitacao.frequencia} />
      <DetailItem label="Observacoes" value={solicitacao.motivo || solicitacao.sintomas} />
      {solicitacao.arquivo_receita_url ? (
        <a
          href={solicitacao.arquivo_receita_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300"
        >
          <Paperclip className="h-4 w-4" />
          Abrir receita anexada
        </a>
      ) : null}
    </div>
  );
}

function AtenderServicoExtraInner() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const solicitacaoId = searchParams.get('solicitacao') || searchParams.get('id') || '';
  const [recomendacoes, setRecomendacoes] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['servico-extra-atendimento', solicitacaoId],
    queryFn: () => getSolicitacaoExameAtendimentoRequest({ solicitacaoId }),
    enabled: Boolean(solicitacaoId),
    retry: false,
  });

  const solicitacao = data?.solicitacaoExame || null;
  const patient = data?.patient || null;
  const serviceLabel = getServiceLabel(solicitacao?.tipo);
  const createdAt = formatDateTime(solicitacao?.created_date);
  const acceptedAt = formatDateTime(solicitacao?.accepted_at);
  const canFinish = recomendacoes.trim().length > 0;

  useEffect(() => {
    if (solicitacao?.id) {
      setRecomendacoes('');
    }
  }, [solicitacao?.id]);

  const finishMutation = useMutation({
    mutationFn: () => finishSolicitacaoExameAtendimentoRequest({
      solicitacaoId,
      recomendacoes: recomendacoes.trim(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-exames'] });
      queryClient.invalidateQueries({ queryKey: ['servico-extra-atendimento', solicitacaoId] });
      queryClient.invalidateQueries({ queryKey: ['patient-prontuarios'] });

      toast({
        title: 'Atendimento finalizado',
        description: 'O plano terapeutico foi salvo e ja pode aparecer no Meu Prontuario do paciente.',
      });

      navigate(createPageUrl('DashboardProfissional'));
    },
    onError: (error) => {
      const code = error?.code || '';
      const description = code === 'RECOMENDACOES_REQUIRED'
        ? 'Preencha o plano terapeutico antes de finalizar.'
        : code === 'SOLICITACAO_EXAME_ALREADY_COMPLETED'
          ? 'Esta solicitacao ja foi concluida.'
        : code === 'SOLICITACAO_EXAME_PAYMENT_REQUIRED'
          ? 'Pagamento ainda nao confirmado.'
        : code === 'SOLICITACAO_EXAME_NOT_IN_PROGRESS'
          ? 'Esta solicitacao nao esta em atendimento.'
        : code === 'SOLICITACAO_EXAME_NOT_FOUND'
          ? 'Solicitacao nao encontrada para este profissional.'
        : error?.message || 'Nao foi possivel finalizar o atendimento.';

      toast({
        title: 'Falha ao finalizar atendimento',
        description,
        variant: 'destructive',
      });
    },
  });

  const patientName = useMemo(() => (
    solicitacao?.paciente_nome || patient?.fullName || 'Paciente'
  ), [patient?.fullName, solicitacao?.paciente_nome]);

  if (!solicitacaoId) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold text-foreground">Solicitacao nao informada</h1>
          <p className="mt-2 text-sm text-muted-foreground">Volte ao dashboard e abra o atendimento novamente.</p>
          <Button className="mt-5" onClick={() => navigate(createPageUrl('DashboardProfissional'))}>
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (isError || !solicitacao) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <Stethoscope className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold text-foreground">Atendimento indisponivel</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error?.message || 'Nao foi possivel carregar esta solicitacao.'}
          </p>
          <Button className="mt-5" onClick={() => navigate(createPageUrl('DashboardProfissional'))}>
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit gap-2 px-0 text-muted-foreground hover:text-foreground"
              onClick={() => navigate(createPageUrl('DashboardProfissional'))}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Atendimento de Servico Extra</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Atendimento assincrono, sem video e sem sala Zoom.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {serviceLabel}
              </Badge>
              <Badge variant="outline" className="border-blue-200 text-blue-700 dark:border-blue-900/60 dark:text-blue-300">
                {getStatusLabel(solicitacao.status)}
              </Badge>
              <NetAmountBadge amount={solicitacao.quoted_professional_net_amount} />
            </div>
          </div>

          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 md:text-right">
            <div className="flex items-center gap-2 md:justify-end">
              <Calendar className="h-4 w-4" />
              Solicitado em {createdAt.date}
            </div>
            <div className="flex items-center gap-2 md:justify-end">
              <Clock className="h-4 w-4" />
              {createdAt.time || 'Horario nao informado'}
            </div>
            <div className="flex items-center gap-2 md:justify-end sm:col-span-2">
              <Clock className="h-4 w-4" />
              Aceito em {acceptedAt.date} {acceptedAt.time ? `as ${acceptedAt.time}` : ''}
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5 text-emerald-600" />
                  Paciente
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <DetailItem label="Nome" value={patientName} />
                <DetailItem label="Sexo" value={formatSex(patient?.sex)} />
                <DetailItem label="Idade" value={formatAge(patient?.birthDate)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-emerald-600" />
                  Dados da solicitacao
                </CardTitle>
              </CardHeader>
              <CardContent>
                {solicitacao.tipo === 'renovacao_receitas' ? (
                  <RenovacaoReceitaDetails solicitacao={solicitacao} />
                ) : (
                  <CheckupDetails solicitacao={solicitacao} patient={patient} />
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-lg">Plano / recomendacoes</CardTitle>
              <p className="text-sm text-muted-foreground">
                Este conteudo sera exibido ao paciente em Meu Prontuario como plano terapeutico.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block text-sm text-foreground">
                  Plano terapeutico e recomendacoes
                </Label>
                <Textarea
                  rows={9}
                  value={recomendacoes}
                  onChange={(event) => setRecomendacoes(event.target.value)}
                  placeholder="Digite as orientacoes, conduta, links de receita, pedido de exames, laudo ou recomendacoes para o paciente..."
                  className="resize-none bg-background text-sm"
                />
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                Links http/https podem ser colados no texto. Eles serao exibidos ao paciente como parte do plano.
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  disabled={!canFinish || finishMutation.isPending}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => {
                    if (!canFinish) {
                      toast({
                        title: 'Plano obrigatorio',
                        description: 'Preencha o plano terapeutico antes de finalizar.',
                        variant: 'destructive',
                      });
                      return;
                    }

                    finishMutation.mutate();
                  }}
                >
                  {finishMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Finalizando...
                    </>
                  ) : (
                    'Finalizar atendimento'
                  )}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link to={createPageUrl('DashboardProfissional')}>Voltar ao Dashboard</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AtenderServicoExtra() {
  return (
    <ProtectedRoute requiredRole="professional">
      <AtenderServicoExtraInner />
    </ProtectedRoute>
  );
}
