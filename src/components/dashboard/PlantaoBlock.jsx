import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Zap, Users, Clock, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import { canWorkOnDuty } from '@/lib/professionals';

const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;

export default function PlantaoBlock({ professional, isOnDuty = false, canToggle = true, queueAll, appointments, onToggle }) {
  const podeAtualPlantao = canWorkOnDuty(professional?.specialty);

  const instantAppts = appointments.filter(a =>
    (a.appointment_type === 'instant' || a.tipo_consulta === 'plantao') &&
    ['completed', 'CONCLUIDO', 'finalizada'].includes(a.status)
  );
  const revenue = instantAppts.reduce((s, a) => s + (a.price || a.preco || 0), 0);
  const queueCompleted = queueAll.filter(a => ['completed', 'in_progress', 'finalizada', 'em_atendimento'].includes(a.status));
  const conversionRate = queueAll.length > 0 ? Math.round((queueCompleted.length / queueAll.length) * 100) : 0;
  const avgWait = queueAll.filter(q => q.estimated_wait_time).length > 0
    ? Math.round(queueAll.filter(q => q.estimated_wait_time).reduce((s, q) => s + q.estimated_wait_time, 0) / queueAll.filter(q => q.estimated_wait_time).length)
    : 0;

  return (
    <Card className="border-0 shadow-sm bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            Plantão
          </CardTitle>
          <div className="flex items-center gap-2">
            <Switch
              checked={isOnDuty}
              onCheckedChange={onToggle}
              disabled={!podeAtualPlantao || !canToggle}
            />
            <Badge className={isOnDuty ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}>
              {isOnDuty ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!podeAtualPlantao && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Plantão disponível apenas para: Clínico Geral, Pediatria, Psicologia e Psiquiatria.
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Atendidos via plantão', value: instantAppts.length, icon: Users, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Taxa de conversão fila', value: `${conversionRate}%`, icon: TrendingUp, color: 'text-indigo-600 bg-indigo-50' },
            { label: 'Tempo médio de espera', value: avgWait ? `${avgWait} min` : '—', icon: Clock, color: 'text-amber-600 bg-amber-50' },
            { label: 'Receita via plantão', value: fmt(revenue), icon: DollarSign, color: 'text-purple-600 bg-purple-50' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
              <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center shrink-0`}>
                <item.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">{item.value}</p>
                <p className="text-xs text-gray-400 leading-tight">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
