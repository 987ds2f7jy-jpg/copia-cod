import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cancelAppointmentRequest } from '@/client-api/appointments';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Video, XCircle, Loader2, Clock, Play } from 'lucide-react';

const STATUS_CONFIG = {
  CONFIRMADO: { label: 'Confirmado', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  SOLICITADO: { label: 'Aguardando', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  CANCELADO: { label: 'Cancelado', className: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' },
  CONCLUIDO: { label: 'Concluido', className: 'bg-muted text-muted-foreground' },
  accepted: { label: 'Confirmado', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  confirmed: { label: 'Confirmado', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  completed: { label: 'Concluido', className: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelado', className: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' },
  in_progress: { label: 'Em andamento', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' },
};

const TYPE_LABELS = {
  PERFIL: 'Por Especialidade',
  ESPECIALIDADE: 'Por Especialidade',
  IMEDIATO: 'Plantao',
  standard: 'Por Especialidade',
  priority: 'Prioritaria',
  instant: 'Plantao',
  padrao: 'Por Especialidade',
  prioritario: 'Prioritaria',
  especialidade: 'Por Especialidade',
  plantao: 'Plantao',
};

function canEnterConsult(appt) {
  const isActive = ['accepted', 'CONFIRMADO', 'confirmed', 'em_atendimento', 'in_progress'].includes(appt.status);

  if (!isActive) return false;

  const dtStr = appt.scheduled_datetime || appt.datetime;

  if (!dtStr) return true;

  const now = new Date();
  const dt = new Date(dtStr);
  const from = new Date(dt.getTime() - 5 * 60 * 1000);
  const to = new Date(dt.getTime() + 30 * 60 * 1000);

  return now >= from && now <= to;
}

export default function MinhasConsultasHoje({ appointments }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [cancelModal, setCancelModal] = useState({ open: false, appointment: null });
  const [cancelReason, setCancelReason] = useState('');

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAppts = appointments
    .filter((a) => {
      const dateStr = a.scheduled_datetime?.slice(0, 10) || a.date;
      return dateStr === todayStr;
    })
    .sort((a, b) => {
      const ta = a.scheduled_datetime || a.date + 'T' + (a.time || '00:00');
      const tb = b.scheduled_datetime || b.date + 'T' + (b.time || '00:00');
      return ta.localeCompare(tb);
    });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) => cancelAppointmentRequest({
      appointmentId: id,
      reason,
    }),
    onSuccess: () => {
      setCancelModal({ open: false, appointment: null });
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['profAppts'] });
    },
  });

  const statusCfg = (status) => STATUS_CONFIG[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  const timeOf = (appt) => {
    if (appt.scheduled_datetime) {
      return appt.scheduled_datetime.substring(11, 16);
    }

    return appt.time || '-';
  };

  return (
    <>
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-500" />
            Minhas Consultas Hoje
          </h3>
          <Badge className="bg-emerald-100 text-emerald-700">{todayAppts.length}</Badge>
        </div>

        <div className="divide-y divide-border max-h-96 overflow-y-auto">
          {todayAppts.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground text-center">
              Nenhuma consulta agendada para hoje.
            </p>
          ) : todayAppts.map((appt) => {
            const cfg = statusCfg(appt.status);
            const canEnter = canEnterConsult(appt);
            const isActive = ['accepted', 'CONFIRMADO', 'confirmed', 'em_atendimento', 'in_progress'].includes(appt.status);

            return (
              <div key={appt.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground">{timeOf(appt)}</span>
                      <Badge className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
                      {appt.appointment_type && (
                        <Badge variant="outline" className="text-xs">
                          {TYPE_LABELS[appt.appointment_type] || appt.appointment_type}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground">{appt.patient_name || 'Paciente'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{appt.specialty}</p>
                    {appt.cancellation_reason && (
                      <p className="text-xs text-red-500 mt-1">Motivo: {appt.cancellation_reason}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {canEnter && (
                      appt.consulta_id ? (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2 gap-1"
                          onClick={() => navigate(`/consulta/${appt.consulta_id}`)}
                        >
                          <Play className="w-3.5 h-3.5" /> Iniciar
                        </Button>
                      ) : appt.meeting_link ? (
                        <a href={appt.meeting_link} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2 gap-1">
                            <Video className="w-3.5 h-3.5" /> Entrar
                          </Button>
                        </a>
                      ) : null
                    )}
                    {isActive && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 text-xs h-7 px-2 gap-1 dark:border-red-900/60 dark:text-red-300"
                        onClick={() => setCancelModal({ open: true, appointment: appt })}
                      >
                        <XCircle className="w-3.5 h-3.5" /> Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={cancelModal.open} onOpenChange={(open) => setCancelModal((modal) => ({ ...modal, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Consulta</DialogTitle>
            <DialogDescription>
              Por favor, informe o motivo do cancelamento. O paciente sera notificado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="p-3 bg-muted/50 rounded-xl text-sm">
              <p className="font-medium">{cancelModal.appointment?.patient_name}</p>
              <p className="text-muted-foreground">
                {cancelModal.appointment?.specialty} · {cancelModal.appointment?.scheduled_datetime?.substring(11, 16) || cancelModal.appointment?.time}
              </p>
            </div>
            <div>
              <Label>Motivo do cancelamento *</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: Emergencia medica, reagendamento necessario..."
                className="mt-1 min-h-[80px]"
              />
            </div>
            <Button
              onClick={() => cancelMutation.mutate({ id: cancelModal.appointment?.id, reason: cancelReason })}
              disabled={!cancelReason.trim() || cancelMutation.isPending}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              {cancelMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirmar Cancelamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
