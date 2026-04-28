import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart2, MessageSquare, Clock, Users, RefreshCw } from 'lucide-react';

export default function PerformanceBlock({ appointments, questions, professional }) {
  const completed = appointments.filter(a => a.status === 'completed');

  // Busiest hour
  const hourMap = {};
  completed.forEach(a => {
    if (a.time) {
      const h = a.time.slice(0, 2) + 'h';
      hourMap[h] = (hourMap[h] || 0) + 1;
    }
  });
  const busiestHour = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  // Specialty demand — uses professional specialty (only one specialty here)
  const specialty = professional?.specialty || '—';

  // Answer rate for questions
  const totalQ = questions.length;
  const answeredQ = questions.filter(q => q.status === 'answered').length;
  const answerRate = totalQ > 0 ? Math.round((answeredQ / totalQ) * 100) : 0;

  // Patient return rate (patients with more than 1 appointment)
  const patientCount = {};
  appointments.forEach(a => { if (a.patient_id) patientCount[a.patient_id] = (patientCount[a.patient_id] || 0) + 1; });
  const returning = Object.values(patientCount).filter(v => v > 1).length;
  const total = Object.keys(patientCount).length;
  const returnRate = total > 0 ? Math.round((returning / total) * 100) : 0;

  const items = [
    { label: 'Horário mais produtivo', value: busiestHour, icon: Clock, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300' },
    { label: 'Especialidade principal', value: specialty, icon: BarChart2, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-300' },
    { label: 'Taxa de retorno', value: `${returnRate}%`, icon: RefreshCw, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300' },
    { label: 'Taxa de resposta (perguntas)', value: `${answerRate}%`, icon: MessageSquare, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300' },
  ];

  return (
    <Card className="border-border shadow-sm bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-purple-500" />
          Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
            <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center shrink-0`}>
              <item.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{item.value}</p>
              <p className="text-xs text-muted-foreground leading-tight">{item.label}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
