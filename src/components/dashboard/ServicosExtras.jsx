import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ClipboardList, Loader2, Mail, Phone, User } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { listDirectSolicitacoesForProfessional } from '@/lib/solicitacoesExames';

async function loadPatientLookup(pacienteIds) {
  const uniqueIds = Array.from(new Set((pacienteIds || []).filter(Boolean)));

  if (uniqueIds.length === 0) {
    return {};
  }

  const results = await Promise.all(
    uniqueIds.map(async (patientId) => {
      const matches = await base44.entities.AppUser.filter({ id: patientId }, undefined, 1);
      return matches?.[0] || null;
    }),
  );

  return Object.fromEntries(
    results
      .filter(Boolean)
      .map((patient) => [patient.id, patient]),
  );
}

export default function ServicosExtras({ professional, onAtender }) {
  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ['solicitacoes-exames', professional?.id, professional?.specialty],
    queryFn: () => listDirectSolicitacoesForProfessional(professional),
    enabled: !!professional?.id,
    refetchInterval: 15000,
  });

  const visibleSolicitacoes = solicitacoes;

  const { data: patientLookup = {}, isLoading: loadingPatients } = useQuery({
    queryKey: ['solicitacoes-exames-patients', visibleSolicitacoes.map((item) => item.paciente_id).join(',')],
    queryFn: () => loadPatientLookup(visibleSolicitacoes.map((item) => item.paciente_id)),
    enabled: visibleSolicitacoes.length > 0,
    staleTime: 60_000,
  });

  const pendingCount = visibleSolicitacoes.length;

  return (
    <div className="bg-white rounded-xl shadow-sm border-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-emerald-500" />
          Servicos Extras
        </h3>
        <Badge className="bg-emerald-100 text-emerald-700">{pendingCount}</Badge>
      </div>
      <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
        {isLoading || loadingPatients ? (
          <div className="px-5 py-6 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : visibleSolicitacoes.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400 text-center">Nenhuma solicitacao pendente</p>
        ) : (
          visibleSolicitacoes.map((solicitacao) => {
            const patient = patientLookup[solicitacao.paciente_id] || null;
            const patientName = solicitacao.paciente_nome || patient?.full_name || 'Paciente';
            const patientEmail = solicitacao.paciente_email || patient?.email || '';
            const patientPhone = solicitacao.paciente_telefone || patient?.phone || '';
            const mergedSolicitacao = {
              ...solicitacao,
              paciente_email: patientEmail,
              paciente_telefone: patientPhone,
              paciente_nome: patientName,
            };

            return (
              <div key={solicitacao.id} className="px-5 py-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-sm font-medium text-gray-800 truncate">{patientName}</span>
                  </div>
                  <Badge variant="outline" className="border-emerald-300 text-emerald-700 text-xs">
                    Check-Up
                  </Badge>
                </div>

                <div className="space-y-1 text-xs text-gray-500">
                  {mergedSolicitacao.exame_solicitado && <p>Exame: {mergedSolicitacao.exame_solicitado}</p>}
                  {mergedSolicitacao.motivo && <p className="line-clamp-2">Motivo: {mergedSolicitacao.motivo}</p>}
                  {patientEmail && (
                    <p className="flex items-center gap-1">
                      <Mail className="w-3 h-3 shrink-0" />
                      <span className="truncate">{patientEmail}</span>
                    </p>
                  )}
                  {patientPhone && (
                    <p className="flex items-center gap-1">
                      <Phone className="w-3 h-3 shrink-0" />
                      <span>{patientPhone}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-400">
                    {solicitacao.created_date ? format(new Date(solicitacao.created_date), 'dd/MM/yyyy HH:mm') : ''}
                  </span>
                  <Button
                    size="sm"
                    className="text-xs px-3 h-7 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => onAtender?.(mergedSolicitacao)}
                  >
                    Atender Solicitacao
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
