import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Zap, Users, Clock, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import { canWorkOnDuty } from '@/lib/professionals';
import { isCompletedAppointmentStatus, isDutyAppointmentRecord } from '@/lib/appointments';

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;

export default function PlantaoBlock({ professional, isOnDuty = false, canToggle = true, queueAll, appointments, onToggle }) {
  const podeAtualPlantao = canWorkOnDuty(professional?.specialty);

  const instantAppts = appointments.filter(a =>
    isDutyAppointmentRecord(a) &&
    (isCompletedAppointmentStatus(a.status) || a.status === 'finalizada')
  );
  const revenue = instantAppts.reduce((s, a) => s + (a.price || a.preco || 0), 0);
  const queueCompleted = queueAll.filter(a => ['completed', 'in_progress', 'finalizada', 'em_atendimento'].includes(a.status));
  const conversionRate = queueAll.length > 0 ? Math.round((queueCompleted.length / queueAll.length) * 100) : 0;
  const avgWait = queueAll.filter(q => q.estimated_wait_time).length > 0
    ? Math.round(queueAll.filter(q => q.estimated_wait_time).reduce((s, q) => s + q.estimated_wait_time, 0) / queueAll.filter(q => q.estimated_wait_time).length)
    : 0;

  return (
    <Card className="border-border shadow-sm bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            Plantão
          </CardTitle>
          <div className="flex items-center gap-2">
            <Switch
              checked={isOnDuty}
              onCheckedChange={onToggle}
              disabled={!podeAtualPlantao || !canToggle}
            />
            <Badge className={isOnDuty ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}>
              {isOnDuty ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!podeAtualPlantao && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-950/30 dark:border-amber-900/60">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Plantão disponível apenas para: Clínico Geral, Pediatria, Psicologia e Psiquiatria.
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Atendidos via plantão', value: instantAppts.length, icon: Users, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300' },
            { label: 'Taxa de conversão fila', value: `${conversionRate}%`, icon: TrendingUp, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300' },
            { label: 'Tempo médio de espera', value: avgWait ? `${avgWait} min` : '—', icon: Clock, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300' },
            { label: 'Receita via plantão', value: fmt(revenue), icon: DollarSign, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-300' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center shrink-0`}>
                <item.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">{item.value}</p>
                <p className="text-xs text-muted-foreground leading-tight">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
