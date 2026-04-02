import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/components/AuthContext';
import { base44 } from '@/api/base44Client';
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

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const PLATFORM_FEE = 0.15;

const TIPO_LABELS = {
  padrao: 'Por Especialidade', prioritario: 'Prioritária',
  especialidade: 'Por Especialidade', plantao: 'Plantão',
  standard: 'Por Especialidade', priority: 'Prioritária', instant: 'Plantão',
  PERFIL: 'Por Especialidade', ESPECIALIDADE: 'Por Especialidade', IMEDIATO: 'Plantão',
};

const STATUS_PAYMENT = {
  completed: { label: 'Pago', cls: 'bg-emerald-100 text-emerald-700' },
  CONCLUIDO: { label: 'Pago', cls: 'bg-emerald-100 text-emerald-700' },
  confirmed: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700' },
  CONFIRMADO: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700' },
  in_progress: { label: 'Retido', cls: 'bg-blue-100 text-blue-700' },
  em_atendimento: { label: 'Retido', cls: 'bg-blue-100 text-blue-700' },
};

function FinanceiroProfissionalInner() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [saqueModal, setSaqueModal] = useState(false);
  const [bankingModal, setBankingModal] = useState(false);
  const [valorSaque, setValorSaque] = useState('');
  const [chavePix, setChavePix] = useState('');

  // Load professional profile
  const { data: professional } = useQuery({
    queryKey: ['myProfessionalProfile', user?.id],
    queryFn: async () => {
      let profs = await base44.entities.ProfessionalProfile.filter({ user_id: user.id });
      if (!profs?.length) profs = await base44.entities.Professional.filter({ user_id: user.id });
      return profs?.[0] || null;
    },
    enabled: !!user?.id,
  });

  // Load all appointments
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['profAppts', professional?.id],
    queryFn: () => base44.entities.Appointment.filter({ professional_id: professional.id }, '-date', 500),
    enabled: !!professional?.id,
  });

  // Load saques
  const { data: saques = [] } = useQuery({
    queryKey: ['saques', professional?.id],
    queryFn: () => base44.entities.Saque.filter({ profissional_id: professional.id }, '-created_date', 50),
    enabled: !!professional?.id,
  });

  // Load banking data
  const { data: bankingData } = useQuery({
    queryKey: ['bankingData', professional?.id],
    queryFn: () => base44.entities.ProfessionalBankingData.filter({ professional_id: professional.id }),
    enabled: !!professional?.id,
    select: (list) => list?.[0] || null,
  });

  const solicitarSaque = useMutation({
    mutationFn: async () => {
      const val = parseFloat(valorSaque);
      if (!val || val <= 0) throw new Error('Valor inválido.');
      if (val > saldoDisponivel) throw new Error('Saldo insuficiente.');
      return base44.entities.Saque.create({
        profissional_id: professional.id,
        profissional_nome: professional.full_name,
        valor: val,
        chave_pix: chavePix,
        status: 'pendente',
      });
    },
    onSuccess: () => {
      toast.success('Solicitação de saque enviada!');
      setSaqueModal(false);
      setValorSaque('');
      setChavePix('');
      queryClient.invalidateQueries({ queryKey: ['saques'] });
    },
    onError: (err) => toast.error(err.message || 'Erro ao solicitar saque.'),
  });

  // KPIs do mês atual
  const today = new Date();
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

  const thisMonth = useMemo(() =>
    appointments.filter(a => (a.date || '') >= monthStart && (a.date || '') <= monthEnd),
    [appointments, monthStart, monthEnd]
  );
  const completed = thisMonth.filter(a => ['completed', 'CONCLUIDO'].includes(a.status));
  const pending = thisMonth.filter(a => ['confirmed', 'CONFIRMADO', 'in_progress', 'em_atendimento'].includes(a.status));

  const revenueMonth = completed.reduce((s, a) => s + (a.price || a.preco || 0), 0);
  const revenuePending = pending.reduce((s, a) => s + (a.price || a.preco || 0), 0);
  const platformFeeMonth = revenueMonth * PLATFORM_FEE;
  const netMonth = revenueMonth - platformFeeMonth;
  const allTimeRevenue = appointments.filter(a => ['completed', 'CONCLUIDO'].includes(a.status)).reduce((s, a) => s + (a.price || a.preco || 0), 0);
  const avgPerConsult = completed.length > 0 ? revenueMonth / completed.length : 0;

  const saquesPagos = saques.filter(s => s.status === 'pago').reduce((s, x) => s + (x.valor || 0), 0);
  const saldoDisponivel = netMonth - saquesPagos;

  // Gráfico: últimos 6 meses
  const chartData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(today, 5 - i);
      const start = format(startOfMonth(d), 'yyyy-MM-dd');
      const end = format(endOfMonth(d), 'yyyy-MM-dd');
      const monthAppts = appointments.filter(a =>
        ['completed', 'CONCLUIDO'].includes(a.status) &&
        (a.date || '') >= start && (a.date || '') <= end
      );
      const gross = monthAppts.reduce((s, a) => s + (a.price || a.preco || 0), 0);
      return {
        mes: format(d, 'MMM', { locale: ptBR }),
        bruto: gross,
        liquido: gross * (1 - PLATFORM_FEE),
      };
    });
  }, [appointments]);

  // Histórico de consultas (todas)
  const historyAppts = [...appointments]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 100);

  const kpis = [
    { label: 'Receita disponível', value: fmt(netMonth), icon: CheckCircle, cls: 'bg-emerald-50 text-emerald-600' },
    { label: 'Receita pendente', value: fmt(revenuePending), icon: Clock, cls: 'bg-amber-50 text-amber-600' },
    { label: 'Taxa plataforma (15%)', value: fmt(platformFeeMonth), icon: DollarSign, cls: 'bg-red-50 text-red-500' },
    { label: 'Receita acumulada', value: fmt(allTimeRevenue), icon: TrendingUp, cls: 'bg-indigo-50 text-indigo-600' },
    { label: 'Total recebido (mês)', value: fmt(revenueMonth), icon: BarChart2, cls: 'bg-purple-50 text-purple-600' },
    { label: 'Média por consulta', value: fmt(avgPerConsult), icon: DollarSign, cls: 'bg-sky-50 text-sky-600' },
  ];

  if (isLoading || !professional) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Relatório Financeiro</h1>
            <p className="text-sm text-gray-500">Resumo de receitas, saques e histórico de consultas</p>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map(k => (
            <Card key={k.label} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className={`w-8 h-8 rounded-lg ${k.cls} flex items-center justify-center mb-2`}>
                  <k.icon className="w-4 h-4" />
                </div>
                <p className="text-lg font-bold text-gray-900">{k.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{k.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Gráfico */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-500" />
              Receita dos últimos 6 meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `R$${v}`} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="bruto" fill="#d1fae5" name="Bruto" radius={[4, 4, 0, 0]} />
                <Bar dataKey="liquido" fill="#10b981" name="Líquido" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 justify-center text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-200 inline-block" /> Bruto</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Líquido</span>
            </div>
          </CardContent>
        </Card>

        {/* Histórico de consultas */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-indigo-500" />
              Histórico de Consultas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="px-5 py-3 text-left font-medium">Data</th>
                    <th className="px-5 py-3 text-left font-medium">Paciente</th>
                    <th className="px-5 py-3 text-left font-medium">Tipo</th>
                    <th className="px-5 py-3 text-right font-medium">Valor bruto</th>
                    <th className="px-5 py-3 text-right font-medium">Taxa (15%)</th>
                    <th className="px-5 py-3 text-right font-medium">Valor líquido</th>
                    <th className="px-5 py-3 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {historyAppts.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">Nenhuma consulta encontrada</td></tr>
                  ) : historyAppts.map(a => {
                    const bruto = a.price || a.preco || 0;
                    const taxa = bruto * PLATFORM_FEE;
                    const liquido = bruto - taxa;
                    const tipo = a.appointment_type || a.tipo_consulta;
                    const payStatus = STATUS_PAYMENT[a.status] || { label: a.status, cls: 'bg-gray-100 text-gray-600' };
                    return (
                      <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                          {a.date ? format(new Date(a.date + 'T00:00'), 'dd/MM/yyyy') : '—'}
                        </td>
                        <td className="px-5 py-3 text-gray-900 font-medium truncate max-w-[150px]">
                          {a.patient_name || a.paciente_nome || '—'}
                        </td>
                        <td className="px-5 py-3 text-gray-500">
                          {TIPO_LABELS[tipo] || tipo || '—'}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-900">{fmt(bruto)}</td>
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

        {/* Saques */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Download className="w-4 h-4 text-purple-500" />
                Saques
              </CardTitle>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1"
                  onClick={() => setBankingModal(true)}>
                  <Landmark className="w-3 h-3" /> Dados Bancários
                </Button>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Saldo disponível</p>
                  <p className="font-bold text-emerald-700">{fmt(Math.max(0, saldoDisponivel))}</p>
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
            <div className="divide-y divide-gray-50">
              {saques.length === 0 ? (
                <p className="px-5 py-6 text-sm text-gray-400 text-center">Nenhum saque solicitado</p>
              ) : saques.map(s => (
                <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{fmt(s.valor)}</p>
                    <p className="text-xs text-gray-400">
                      {s.created_date ? format(new Date(s.created_date), 'dd/MM/yyyy HH:mm') : '—'}
                      {s.chave_pix ? ` · PIX: ${s.chave_pix}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.comprovante_url && (
                      <a href={s.comprovante_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-emerald-600 hover:underline">Comprovante</a>
                    )}
                    <Badge className={{
                      pendente: 'bg-amber-100 text-amber-700',
                      processando: 'bg-blue-100 text-blue-700',
                      pago: 'bg-emerald-100 text-emerald-700',
                      rejeitado: 'bg-red-100 text-red-700',
                    }[s.status] || 'bg-gray-100 text-gray-600'}>
                      {{ pendente: 'Pendente', processando: 'Processando', pago: 'Pago', rejeitado: 'Rejeitado' }[s.status] || s.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <BankingDataModal open={bankingModal} onOpenChange={setBankingModal} professionalId={professional?.id} />

      {/* Dados bancários salvos */}
      {bankingData && (
        <div className="mx-4 sm:mx-6 lg:mx-8 mb-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-sm text-emerald-800">
          <Landmark className="w-4 h-4 shrink-0" />
          {bankingData.tipo_recebimento === 'PIX'
            ? `PIX (${bankingData.tipo_chave_pix}): ${bankingData.chave_pix}`
            : `${bankingData.tipo_conta === 'CORRENTE' ? 'Conta Corrente' : 'Conta Poupança'} ${bankingData.banco} • Ag. ${bankingData.agencia} • Conta ${bankingData.conta}-${bankingData.digito_conta}`
          }
        </div>
      )}

      {/* Modal Saque */}
      <Dialog open={saqueModal} onOpenChange={setSaqueModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Saque</DialogTitle>
            <DialogDescription>
              Saldo disponível: {fmt(Math.max(0, saldoDisponivel))}
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
                onChange={e => setValorSaque(e.target.value)}
                placeholder="Ex: 500.00"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Chave PIX</Label>
              <Input
                value={chavePix}
                onChange={e => setChavePix(e.target.value)}
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                className="mt-1"
              />
            </div>
            {saldoDisponivel <= 0 && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg text-xs text-amber-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Você não tem saldo disponível para saque no momento.
              </div>
            )}
            <Button
              onClick={() => solicitarSaque.mutate()}
              disabled={!valorSaque || !chavePix || solicitarSaque.isPending || saldoDisponivel <= 0}
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