import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { subDays, subMonths, format, startOfMonth, endOfMonth, eachDayOfInterval, eachMonthOfInterval, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmt = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;

export default function RevenueChart({ appointments }) {
  const [view, setView] = useState('week'); // 'week' | 'month'

  const today = new Date();

  const weekData = eachDayOfInterval({ start: subDays(today, 6), end: today }).map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const completed = appointments.filter(a => a.date === dayStr && a.status === 'completed');
    const revenue = completed.reduce((s, a) => s + (a.price || 0), 0);
    return { name: format(day, 'EEE', { locale: ptBR }), receita: revenue, consultas: completed.length };
  });

  const monthData = eachMonthOfInterval({ start: subMonths(today, 5), end: today }).map(month => {
    const mo = format(month, 'yyyy-MM');
    const completed = appointments.filter(a => a.date?.startsWith(mo) && a.status === 'completed');
    const revenue = completed.reduce((s, a) => s + (a.price || 0), 0);
    return { name: format(month, 'MMM', { locale: ptBR }), receita: revenue, consultas: completed.length };
  });

  const data = view === 'week' ? weekData : monthData;

  return (
    <Card className="border-border shadow-sm bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground">Receita</CardTitle>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {['week', 'month'].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  view === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {v === 'week' ? '7 dias' : '6 meses'}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="receitaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} width={45} />
            <Tooltip formatter={(v) => [fmt(v), 'Receita']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }} />
            <Area type="monotone" dataKey="receita" stroke="#10B981" strokeWidth={2} fill="url(#receitaGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
