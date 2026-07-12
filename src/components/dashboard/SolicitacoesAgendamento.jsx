import React, { useState } from 'react';
import { entities } from '@/client-api/readModels';
import { acceptAppointmentRequest } from '@/client-api/appointments';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, CheckCircle, Loader2, AlertCircle, Users, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import NetAmountBadge from './NetAmountBadge';

export default function SolicitacoesAgendamento({ professional }) {
  const queryClient = useQueryClient();
  const [acceptingId, setAcceptingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const { data: solBySpecialty = [] } = useQuery({
    queryKey: ['solicitacoes-esp', professional?.id, professional?.specialty],
    queryFn: () => entities.Appointment.filter({
      specialty: professional.specialty,
      appointment_type: 'ESPECIALIDADE',
      status: 'SOLICITADO',
    }, '-scheduled_datetime', 50),
    enabled: !!professional?.id && !!professional?.specialty,
    refetchInterval: 30_000,
  });

  const { data: solPriority = [] } = useQuery({
    queryKey: ['solicitacoes-pri', professional?.id],
    queryFn: () => entities.Appointment.filter({
      professional_id: professional.id,
      appointment_type: 'priority',
      status: 'SOLICITADO',
    }, '-scheduled_datetime', 50),
    enabled: !!professional?.id,
    refetchInterval: 30_000,
  });

  const { data: solStandardProfile = [] } = useQuery({
    queryKey: ['solicitacoes-perfil', professional?.id],
    queryFn: () => entities.Appointment.filter({
      professional_id: professional.id,
      appointment_type: 'PERFIL',
      status: 'SOLICITADO',
    }, '-scheduled_datetime', 50),
    enabled: !!professional?.id,
    refetchInterval: 30_000,
  });

  const isLoading = false;
  const solicitacoes = [...solBySpecialty, ...solPriority, ...solStandardProfile]
    .filter((item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx)
    .sort((a, b) => (b.scheduled_datetime || '').localeCompare(a.scheduled_datetime || ''));

  const acceptMutation = useMutation({
    mutationFn: async (solicitacao) => {
      setErrorMsg(null);

      const result = await acceptAppointmentRequest({
        appointmentId: solicitacao.id,
      });

      if (!result?.appointment?.id || !result?.consulta?.id) {
        throw new Error('Resposta invalida ao aceitar a solicitacao.');
      }

      return result;
    },
    onSuccess: (result, solicitacao) => {
      const removeAcceptedRequest = (items) => (
        Array.isArray(items)
          ? items.filter((item) => item.id !== solicitacao.id)
          : []
      );

      queryClient.setQueryData(
        ['solicitacoes-esp', professional?.id, professional?.specialty],
        removeAcceptedRequest,
      );
      queryClient.setQueryData(
        ['solicitacoes-pri', professional?.id],
        removeAcceptedRequest,
      );
      queryClient.setQueryData(
        ['solicitacoes-perfil', professional?.id],
        removeAcceptedRequest,
      );
      queryClient.setQueryData(['profAppts', professional?.id], (items) => {
        if (!Array.isArray(items)) {
          return items;
        }

        const nextAppointment = {
          ...solicitacao,
          professional_id: result.appointment.professionalId || professional?.id,
          professional_name: result.appointment.professionalName || professional?.full_name,
          status: result.appointment.status,
          accepted_at: result.appointment.acceptedAt,
          consulta_id: result.consulta.id,
          scheduled_datetime: result.appointment.scheduledAt || solicitacao.scheduled_datetime,
        };

        return [
          nextAppointment,
          ...items.filter((item) => item.id !== solicitacao.id),
        ];
      });

      queryClient.invalidateQueries({ queryKey: ['solicitacoes-esp'] });
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-pri'] });
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-perfil'] });
      queryClient.invalidateQueries({ queryKey: ['profAppts'] });
      queryClient.invalidateQueries({ queryKey: ['patientAppointments'] });
      setAcceptingId(null);
    },
    onError: (err) => {
      if (err?.code === 'APPOINTMENT_EXPIRED') {
        setErrorMsg('Esta solicitação já passou do horário e não pode mais ser aceita.');
        queryClient.invalidateQueries({ queryKey: ['solicitacoes-esp'] });
        queryClient.invalidateQueries({ queryKey: ['solicitacoes-pri'] });
        queryClient.invalidateQueries({ queryKey: ['solicitacoes-perfil'] });
        setAcceptingId(null);
        return;
      }

      setErrorMsg(err.message || 'Erro ao aceitar solicitacao.');
      setAcceptingId(null);
    },
  });

  const formatDt = (dt) => {
    if (!dt) return '-';

    try {
      return format(new Date(dt), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR });
    } catch {
      return dt;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-sm p-5 flex items-center justify-center h-32">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-500" />
          Solicitacoes de Agendamento
        </h3>
        <Badge className="bg-blue-100 text-blue-700">{solicitacoes.length}</Badge>
      </div>

      {errorMsg && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2 dark:bg-red-950/30 dark:border-red-900/60 dark:text-red-300">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {errorMsg}
          <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-400 hover:text-red-600">x</button>
        </div>
      )}

      <div className="divide-y divide-border max-h-80 overflow-y-auto">
        {solicitacoes.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground text-center">
            Nenhuma solicitacao pendente para {professional.specialty}
          </p>
        ) : solicitacoes.map((sol) => (
          <div key={sol.id} className="px-5 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{sol.patient_name}</p>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">{sol.specialty}</p>
                {sol.funding_source === 'plan' && (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    Coberto por plano
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {formatDt(sol.scheduled_datetime)}
                </span>
              </div>
              {sol.funding_source === 'plan' && sol.coverage_status === 'plan_pending_use' && (
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Crédito pendente de uso no aceite</p>
              )}
              {sol.symptoms && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">"{sol.symptoms}"</p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <NetAmountBadge amount={sol.professional_net_amount} />
              <Button
                size="sm"
                disabled={acceptingId === sol.id || acceptMutation.isPending}
                onClick={() => {
                  setAcceptingId(sol.id);
                  acceptMutation.mutate(sol);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 h-8"
              >
                {acceptingId === sol.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 mr-1" />
                    Aceitar
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
