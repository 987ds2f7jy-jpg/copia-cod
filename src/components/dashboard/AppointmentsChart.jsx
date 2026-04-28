import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { subDays, subMonths, format, eachDayOfInterval, eachMonthOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { isCancelledAppointmentStatus, isDutyAppointmentRecord } from '@/lib/appointments';

export default function AppointmentsChart({ appointments }) {
  const [view, setView] = useState('week');
  const today = new Date();

  const buildData = (items) => items.map(item => ({
    ...item,
    agendado: appointments.filter(a =>
      a.date?.startsWith(item.key) &&
      !isDutyAppointmentRecord(a) &&
      !isCancelledAppointmentStatus(a.status)
    ).length,
    plantao: appointments.filter(a =>
      a.date?.startsWith(item.key) &&
      isDutyAppointmentRecord(a) &&
      !isCancelledAppointmentStatus(a.status)
    ).length,
  }));

  const weekData = buildData(
    eachDayOfInterval({ start: subDays(today, 6), end: today }).map(d => ({
      key: format(d, 'yyyy-MM-dd'),
      name: format(d, 'EEE', { locale: ptBR }),
    }))
  );

  const monthData = buildData(
    eachMonthOfInterval({ start: subMonths(today, 5), end: today }).map(m => ({
      key: format(m, 'yyyy-MM'),
      name: format(m, 'MMM', { locale: ptBR }),
    }))
  );

  const data = view === 'week' ? weekData : monthData;

  return (
    <Card className="border-border shadow-sm bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground">Atendimentos</CardTitle>
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
          <BarChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} width={25} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="agendado" name="Agendado" fill="#6366F1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="plantao" name="Plantão" fill="#10B981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
