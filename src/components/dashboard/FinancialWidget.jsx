import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Clock, CheckCircle, TrendingUp, ExternalLink, Landmark } from 'lucide-react';
import BankingDataModal from './BankingDataModal';
import { format, startOfMonth, endOfMonth } from 'date-fns';

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function FinancialWidget({ appointments, professionalId }) {
  const navigate = useNavigate();
  const [bankingOpen, setBankingOpen] = useState(false);
  const today = new Date();
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

  const thisMonthAll = appointments.filter(a => a.date >= monthStart && a.date <= monthEnd);
  const completed = thisMonthAll.filter(a => a.status === 'completed');
  const pending = thisMonthAll.filter(a => ['pending', 'accepted', 'confirmed', 'in_progress'].includes(a.status));

  const revenueCompleted = completed.reduce((s, a) => s + (a.price || 0), 0);
  const revenuePending = pending.reduce((s, a) => s + (a.price || 0), 0);
  const platformFee = revenueCompleted * 0.15; // 15% taxa estimada
  const net = revenueCompleted - platformFee;

  const allTime = appointments.filter(a => a.status === 'completed').reduce((s, a) => s + (a.price || 0), 0);

  const rows = [
    { label: 'Receita disponível', value: fmt(net), icon: CheckCircle, cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300' },
    { label: 'Receita pendente', value: fmt(revenuePending), icon: Clock, cls: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300' },
    { label: 'Taxa plataforma (est. 15%)', value: fmt(platformFee), icon: DollarSign, cls: 'text-red-500 bg-red-50 dark:bg-red-950/40 dark:text-red-300' },
    { label: 'Receita acumulada', value: fmt(allTime), icon: TrendingUp, cls: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300' },
  ];

  return (
    <Card className="border-border shadow-sm bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            Financeiro do Mês
          </CardTitle>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1"
              onClick={() => setBankingOpen(true)}>
              <Landmark className="w-3 h-3" /> Dados Bancários
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1"
              onClick={() => navigate('/FinanceiroProfissional')}>
              <ExternalLink className="w-3 h-3" /> Ver relatório
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map(row => (
          <div key={row.label} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg ${row.cls} flex items-center justify-center`}>
                <row.icon className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs text-muted-foreground">{row.label}</span>
            </div>
            <span className="text-sm font-semibold text-foreground">{row.value}</span>
          </div>
        ))}
      </CardContent>

      <BankingDataModal open={bankingOpen} onOpenChange={setBankingOpen} professionalId={professionalId} />
    </Card>
  );
}
