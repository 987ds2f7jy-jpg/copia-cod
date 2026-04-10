import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, CheckCircle, Loader2, AlertCircle, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { acceptAppointmentRequest } from '@/client-api/professionalAppointments';

export default function SolicitacoesAgendamento({ professional, appointments = [] }) {
  const queryClient = useQueryClient();
  const [acceptingId, setAcceptingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const solicitacoes = useMemo(() => (
    appointments
      .filter((item) => {
        if (!item?.id) {
          return false;
        }

        const isPending = item.status === 'SOLICITADO';
        const isPriority = item.appointment_type === 'priority' && item.professional_id === professional?.id;
        const isSpecialty = item.appointment_type === 'ESPECIALIDADE' && item.specialty === professional?.specialty;
        return isPending && (isPriority || isSpecialty);
      })
      .filter((item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx)
      .sort((a, b) => (b.scheduled_datetime || '').localeCompare(a.scheduled_datetime || ''))
  ), [appointments, professional?.id, professional?.specialty]);

  const acceptMutation = useMutation({
    mutationFn: async (solicitacao) => {
      setErrorMsg(null);
      const data = await acceptAppointmentRequest({ appointmentId: solicitacao.id });
      if (!data?.appointment?.id || !data?.consulta?.id) {
        throw new Error('Resposta invalida ao aceitar a solicitacao.');
      }
      return data;
    },
    onSuccess: (result, solicitacao) => {
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
      queryClient.invalidateQueries({ queryKey: ['profAppts'] });
      queryClient.invalidateQueries({ queryKey: ['patientAppointments'] });
      setAcceptingId(null);
    },
    onError: (err) => {
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

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-500" />
          Solicitacoes de Agendamento
        </h3>
        <Badge className="bg-blue-100 text-blue-700">{solicitacoes.length}</Badge>
      </div>

      {errorMsg && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {errorMsg}
          <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-400 hover:text-red-600">x</button>
        </div>
      )}

      <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
        {solicitacoes.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">
            Nenhuma solicitacao pendente para {professional.specialty}
          </p>
        ) : solicitacoes.map((sol) => (
          <div key={sol.id} className="px-5 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-400">{sol.patient_name}</p>
              <p className="text-sm font-medium text-gray-700">{sol.specialty}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {formatDt(sol.scheduled_datetime)}
                </span>
              </div>
              {sol.symptoms && (
                <p className="text-xs text-gray-400 mt-1 line-clamp-1">"{sol.symptoms}"</p>
              )}
            </div>
            <Button
              size="sm"
              disabled={acceptingId === sol.id || acceptMutation.isPending}
              onClick={() => {
                setAcceptingId(sol.id);
                acceptMutation.mutate(sol);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 h-8 shrink-0"
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
        ))}
      </div>
    </div>
  );
}
