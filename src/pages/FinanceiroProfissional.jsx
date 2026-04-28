import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/components/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import BankingDataModal from '@/components/dashboard/BankingDataModal';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DollarSign, TrendingUp, Clock, CheckCircle, ArrowLeft,
  Loader2, Download, AlertCircle, BarChart2, Landmark
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { toast } from 'sonner';
import { buildSaquePayload, buildWithdrawalMethodSummary, getSaqueDescriptor, SAQUE_STATUS_META } from '@/lib/saques';
import { getFinanceDashboardRequest, requestWithdrawalRequest } from '@/client-api/finance';

const fmt = (value) => `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const PLATFORM_FEE = 0.15;

const TIPO_LABELS = {
  padrao: 'Por Especialidade',
  prioritario: 'Prioritaria',
  especialidade: 'Por Especialidade',
  plantao: 'Plantao',
  standard: 'Por Especialidade',
  priority: 'Prioritaria',
  instant: 'Plantao',
  PERFIL: 'Por Especialidade',
  ESPECIALIDADE: 'Por Especialidade',
  IMEDIATO: 'Plantao',
};

const STATUS_PAYMENT = {
  completed: { label: 'Pago', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  CONCLUIDO: { label: 'Pago', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  accepted: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  confirmed: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  CONFIRMADO: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  in_progress: { label: 'Retido', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' },
  em_atendimento: { label: 'Retido', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' },
};

function FinanceiroProfissionalInner() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [saqueModal, setSaqueModal] = useState(false);
  const [bankingModal, setBankingModal] = useState(false);
  const [valorSaque, setValorSaque] = useState('');
  const [chavePix, setChavePix] = useState('');

  const { data: professional } = useQuery({
    queryKey: ['myProfessionalProfile', user?.id],
    queryFn: async () => {
      const result = await getFinanceDashboardRequest({ appointmentsLimit: 1, saquesLimit: 1 });
      return result?.professional || null;
    },
    enabled: !!user?.id,
  });

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['profAppts', professional?.id],
    queryFn: async () => {
      const result = await getFinanceDashboardRequest({ appointmentsLimit: 500, saquesLimit: 1 });
      return result?.appointments || [];
    },
    enabled: !!professional?.id,
  });

  const { data: saques = [] } = useQuery({
    queryKey: ['saques', professional?.id],
    queryFn: async () => {
      const result = await getFinanceDashboardRequest({ appointmentsLimit: 1, saquesLimit: 50 });
      return result?.saques || [];
    },
    enabled: !!professional?.id,
  });

  const { data: bankingData } = useQuery({
    queryKey: ['bankingData', professional?.id],
    queryFn: async () => {
      const result = await getFinanceDashboardRequest({ appointmentsLimit: 1, saquesLimit: 1 });
      return result?.bankingData ? [result.bankingData] : [];
    },
    enabled: !!professional?.id,
    select: (list) => list?.[0] || null,
  });

  const today = new Date();
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

  const thisMonth = useMemo(
    () => appointments.filter((appointment) => (appointment.date || '') >= monthStart && (appointment.date || '') <= monthEnd),
    [appointments, monthStart, monthEnd]
  );
  const completed = thisMonth.filter((appointment) => ['completed', 'CONCLUIDO'].includes(appointment.status));
  const pending = thisMonth.filter((appointment) => ['accepted', 'confirmed', 'CONFIRMADO', 'in_progress', 'em_atendimento'].includes(appointment.status));

  const revenueMonth = completed.reduce((sum, appointment) => sum + (appointment.price || appointment.preco || 0), 0);
  const revenuePending = pending.reduce((sum, appointment) => sum + (appointment.price || appointment.preco || 0), 0);
  const platformFeeMonth = revenueMonth * PLATFORM_FEE;
  const netMonth = revenueMonth - platformFeeMonth;
  const allTimeRevenue = appointments
    .filter((appointment) => ['completed', 'CONCLUIDO'].includes(appointment.status))
    .reduce((sum, appointment) => sum + (appointment.price || appointment.preco || 0), 0);
  const avgPerConsult = completed.length > 0 ? revenueMonth / completed.length : 0;

  const saquesPagos = saques
    .filter((saque) => saque.status === 'pago')
    .reduce((sum, saque) => sum + (saque.valor || 0), 0);
  const saldoDisponivel = Math.max(0, netMonth - saquesPagos);

  const chartData = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => {
      const month = subMonths(today, 5 - index);
      const start = format(startOfMonth(month), 'yyyy-MM-dd');
      const end = format(endOfMonth(month), 'yyyy-MM-dd');
      const monthAppointments = appointments.filter((appointment) =>
        ['completed', 'CONCLUIDO'].includes(appointment.status) &&
        (appointment.date || '') >= start &&
        (appointment.date || '') <= end
      );
      const gross = monthAppointments.reduce((sum, appointment) => sum + (appointment.price || appointment.preco || 0), 0);

      return {
        mes: format(month, 'MMM', { locale: ptBR }),
        bruto: gross,
        liquido: gross * (1 - PLATFORM_FEE),
      };
    });
  }, [appointments, today]);

  const historyAppts = [...appointments]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 100);

  const solicitarSaque = useMutation({
    mutationFn: async () => {
      const value = parseFloat(valorSaque);
      if (!value || value <= 0) throw new Error('Valor invalido.');
      if (value > saldoDisponivel) throw new Error('Saldo insuficiente.');

      const payoutData = chavePix
        ? {
            ...(bankingData || {}),
            tipo_recebimento: 'PIX',
            tipo_chave_pix: bankingData?.tipo_chave_pix || 'INFORMADA',
            chave_pix: chavePix,
          }
        : bankingData;

      if (!payoutData) {
        throw new Error('Cadastre seus dados bancarios ou informe uma chave PIX antes de solicitar o saque.');
      }

      // O backend recalcula saldo e registra o saque.
      return requestWithdrawalRequest({
        value,
        pixKey: chavePix || null,
      });
    },
    onSuccess: () => {
      toast.success('Solicitacao de saque enviada!');
      setSaqueModal(false);
      setValorSaque('');
      setChavePix('');
      queryClient.invalidateQueries({ queryKey: ['saques', professional?.id] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] });
    },
    onError: (error) => toast.error(error.message || 'Erro ao solicitar saque.'),
  });

  const kpis = [
    { label: 'Receita disponivel', value: fmt(netMonth), icon: CheckCircle, cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300' },
    { label: 'Receita pendente', value: fmt(revenuePending), icon: Clock, cls: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300' },
    { label: 'Taxa plataforma (15%)', value: fmt(platformFeeMonth), icon: DollarSign, cls: 'bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-300' },
    { label: 'Receita acumulada', value: fmt(allTimeRevenue), icon: TrendingUp, cls: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300' },
    { label: 'Total recebido (mes)', value: fmt(revenueMonth), icon: BarChart2, cls: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300' },
    { label: 'Media por consulta', value: fmt(avgPerConsult), icon: DollarSign, cls: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300' },
  ];

  if (isLoading || !professional) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatorio Financeiro</h1>
            <p className="text-sm text-muted-foreground">Resumo de receitas, saques e historico de consultas</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="border-border shadow-sm">
              <CardContent className="p-4">
                <div className={`w-8 h-8 rounded-lg ${kpi.cls} flex items-center justify-center mb-2`}>
                  <kpi.icon className="w-4 h-4" />
                </div>
                <p className="text-lg font-bold text-foreground">{kpi.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-500" />
              Receita dos ultimos 6 meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(value) => `R$${value}`} />
                <Tooltip formatter={(value) => fmt(value)} contentStyle={{ border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }} />
                <Bar dataKey="bruto" fill="#d1fae5" name="Bruto" radius={[4, 4, 0, 0]} />
                <Bar dataKey="liquido" fill="#10b981" name="Liquido" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 justify-center text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-200 inline-block" /> Bruto</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Liquido</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-indigo-500" />
              Historico de Consultas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="px-5 py-3 text-left font-medium">Data</th>
                    <th className="px-5 py-3 text-left font-medium">Paciente</th>
                    <th className="px-5 py-3 text-left font-medium">Tipo</th>
                    <th className="px-5 py-3 text-right font-medium">Valor bruto</th>
                    <th className="px-5 py-3 text-right font-medium">Taxa (15%)</th>
                    <th className="px-5 py-3 text-right font-medium">Valor liquido</th>
                    <th className="px-5 py-3 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {historyAppts.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">Nenhuma consulta encontrada</td></tr>
                  ) : historyAppts.map((appointment) => {
                    const bruto = appointment.price || appointment.preco || 0;
                    const taxa = bruto * PLATFORM_FEE;
                    const liquido = bruto - taxa;
                    const tipo = appointment.appointment_type || appointment.tipo_consulta;
                    const payStatus = STATUS_PAYMENT[appointment.status] || { label: appointment.status, cls: 'bg-muted text-muted-foreground' };

                    return (
                      <tr key={appointment.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">
                          {appointment.date ? format(new Date(`${appointment.date}T00:00`), 'dd/MM/yyyy') : '—'}
                        </td>
                        <td className="px-5 py-3 text-foreground font-medium truncate max-w-[150px]">
                          {appointment.patient_name || appointment.paciente_nome || '—'}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {TIPO_LABELS[tipo] || tipo || '—'}
                        </td>
                        <td className="px-5 py-3 text-right text-foreground">{fmt(bruto)}</td>
                        <td className="px-5 py-3 text-right text-red-500">-{fmt(taxa)}</td>
                        <td className="px-5 py-3 text-right font-semibold text-emerald-700">{fmt(liquido)}</td>
                        <td className="px-5 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${payStatus.cls}`}>
                            {payStatus.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Download className="w-4 h-4 text-purple-500" />
                Saques
              </CardTitle>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => setBankingModal(true)}>
                  <Landmark className="w-3 h-3" /> Dados Bancarios
                </Button>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Saldo disponivel</p>
                  <p className="font-bold text-emerald-700">{fmt(saldoDisponivel)}</p>
                </div>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => setSaqueModal(true)}
                  disabled={saldoDisponivel <= 0}
                >
                  Solicitar Saque
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {saques.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground text-center">Nenhum saque solicitado</p>
              ) : saques.map((saque) => {
                const statusMeta = SAQUE_STATUS_META[saque.status] || { label: saque.status, cls: 'bg-muted text-muted-foreground' };
                const descriptor = getSaqueDescriptor(saque);

                return (
                  <div key={saque.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{fmt(saque.valor)}</p>
                      <p className="text-xs text-muted-foreground">
                        {saque.created_date ? format(new Date(saque.created_date), 'dd/MM/yyyy HH:mm') : '—'}
                        {descriptor ? ` · ${descriptor}` : ''}
                      </p>
                    </div>
                    <Badge className={statusMeta.cls}>{statusMeta.label}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <BankingDataModal open={bankingModal} onOpenChange={setBankingModal} professionalId={professional?.id} />

      {bankingData && (
        <div className="mx-4 sm:mx-6 lg:mx-8 mb-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900/60 dark:text-emerald-200">
          <Landmark className="w-4 h-4 shrink-0" />
          {buildWithdrawalMethodSummary(bankingData)}
        </div>
      )}

      <Dialog open={saqueModal} onOpenChange={setSaqueModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Saque</DialogTitle>
            <DialogDescription>
              Saldo disponivel: {fmt(saldoDisponivel)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                min="1"
                max={saldoDisponivel}
                step="0.01"
                value={valorSaque}
                onChange={(event) => setValorSaque(event.target.value)}
                placeholder="Ex: 500.00"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Chave PIX avulsa (opcional)</Label>
              <Input
                value={chavePix}
                onChange={(event) => setChavePix(event.target.value)}
                placeholder={bankingData ? 'Deixe em branco para usar os dados salvos' : 'CPF, e-mail, telefone ou chave aleatoria'}
                className="mt-1"
              />
            </div>

            {!bankingData && !chavePix && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Cadastre seus dados bancarios ou informe uma chave PIX para continuar.
              </div>
            )}

            {saldoDisponivel <= 0 && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Voce nao tem saldo disponivel para saque no momento.
              </div>
            )}

            <Button
              onClick={() => solicitarSaque.mutate()}
              disabled={!valorSaque || solicitarSaque.isPending || saldoDisponivel <= 0 || (!bankingData && !chavePix)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {solicitarSaque.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirmar Saque
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function FinanceiroProfissional() {
  return (
    <ProtectedRoute requiredRole="professional">
      <FinanceiroProfissionalInner />
    </ProtectedRoute>
  );
}
