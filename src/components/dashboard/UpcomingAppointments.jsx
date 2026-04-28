import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Video } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_MAP = {
  pending:       { label: 'Pendente',     cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  SOLICITADO:    { label: 'Solicitado',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  accepted:      { label: 'Confirmada',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  confirmed:     { label: 'Confirmada',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  CONFIRMADO:    { label: 'Confirmada',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  in_progress:   { label: 'Em andamento', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' },
  em_atendimento:{ label: 'Em andamento', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' },
  aguardando:    { label: 'Aguardando',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
};

// Tipos que aparecem em "Próximas" — plantão NUNCA aparece aqui
const VALID_TYPES = ['padrao', 'prioritario', 'especialidade', 'standard', 'priority', 'PERFIL', 'ESPECIALIDADE', 'IMEDIATO', undefined, null];

function canStart(a) {
  const isActive = ['accepted', 'CONFIRMADO', 'confirmed', 'em_atendimento', 'in_progress'].includes(a.status);
  if (!isActive) return false;
  const dtStr = a.scheduled_datetime || a.datetime;
  if (!dtStr) return isActive; // sem datetime: mostrar se ativo
  const now = new Date();
  const dt = new Date(dtStr);
  const from = new Date(dt.getTime() - 5 * 60 * 1000);
  const to = new Date(dt.getTime() + 30 * 60 * 1000);
  return now >= from && now <= to;
}

function formatApptDate(a) {
  const dtStr = a.scheduled_datetime || a.datetime;
  if (dtStr) {
    try { return format(new Date(dtStr), "dd/MM 'às' HH:mm", { locale: ptBR }); } catch { return dtStr; }
  }
  const date = a.date ? format(new Date(a.date + 'T00:00'), 'dd/MM') : '—';
  return a.time ? `${date} às ${a.time}` : date;
}

const TIPO_LABELS = {
  padrao: 'Por Especialidade', prioritario: 'Prioritária',
  especialidade: 'Por Especialidade', plantao: 'Plantão',
  standard: 'Padrão', priority: 'Prioritária', instant: 'Imediata',
  PERFIL: 'Direto', ESPECIALIDADE: 'Especialidade', IMEDIATO: 'Imediata',
};

export default function UpcomingAppointments({ appointments, onStart }) {
  const navigate = useNavigate();
  const ACTIVE = ['pending', 'accepted', 'confirmed', 'in_progress', 'SOLICITADO', 'CONFIRMADO', 'aguardando', 'em_atendimento'];

  const upcoming = [...appointments]
    .filter(a =>
      ACTIVE.includes(a.status) &&
      VALID_TYPES.includes(a.appointment_type || a.tipo_consulta)
    )
    .sort((a, b) => {
      const da = a.scheduled_datetime || a.datetime || (a.date + (a.time || ''));
      const db = b.scheduled_datetime || b.datetime || (b.date + (b.time || ''));
      return (da || '').localeCompare(db || '');
    })
    .slice(0, 5);

  const handleStart = (a) => {
    // Se tem consulta_id (nova entidade), navega para /consulta/:id
    if (a.consulta_id) {
      navigate(`/consulta/${a.consulta_id}`);
    } else {
      // Appointment antigo: chamar callback do pai
      onStart && onStart(a);
    }
  };

  return (
    <Card className="border-border shadow-sm bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-500" />
          Próximas Consultas
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {upcoming.length === 0 ? (
          <div className="px-6 pb-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma consulta agendada</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {upcoming.map(a => {
              const st = STATUS_MAP[a.status] || { label: a.status, cls: 'bg-muted text-muted-foreground' };
              const showStart = canStart(a);
              const tipo = a.appointment_type || a.tipo_consulta;
              return (
                <div key={a.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{a.patient_name || a.paciente_nome}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Clock className="w-3 h-3" />
                      {formatApptDate(a)}
                      {tipo && <span className="text-border">·</span>}
                      {tipo && <span className="text-muted-foreground">{TIPO_LABELS[tipo] || tipo}</span>}
                    </div>
                    {(a.symptoms || a.descricao_sintomas) && (
                      <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-0.5 mt-1 truncate dark:bg-amber-950/30 dark:text-amber-300">
                        {a.symptoms || a.descricao_sintomas}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`text-xs ${st.cls}`}>{st.label}</Badge>
                    {showStart && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2 h-7"
                        onClick={() => handleStart(a)}
                      >
                        <Video className="w-3 h-3 mr-1" /> Iniciar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
