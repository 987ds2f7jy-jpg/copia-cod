import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { differenceInYears, format } from 'date-fns';
import { ClipboardList, Loader2, Paperclip, User } from 'lucide-react';
import { getTeleconsultaContextRequest } from '@/client-api/teleconsulta';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { listDirectSolicitacoesForProfessional } from '@/lib/solicitacoesExames';
import NetAmountBadge from './NetAmountBadge';

function formatSexLabel(value) {
  if (!value) {
    return 'Nao informado';
  }

  const normalized = String(value).trim().toLowerCase();

  if (normalized === 'masculino') {
    return 'Masculino';
  }

  if (normalized === 'feminino') {
    return 'Feminino';
  }

  return 'Outro';
}

function formatAge(value) {
  if (!value) {
    return 'Nao informado';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Nao informado';
  }

  const age = differenceInYears(new Date(), date);
  return age >= 0 ? `${age} anos` : 'Nao informado';
}

export default function ServicosExtras({ professional, onAtender }) {
  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ['solicitacoes-exames', professional?.id, professional?.specialty],
    queryFn: () => listDirectSolicitacoesForProfessional(professional),
    enabled: Boolean(professional?.id),
    refetchInterval: 15000,
  });

  const visibleSolicitacoes = solicitacoes;
  const patientIds = useMemo(
    () => Array.from(new Set(visibleSolicitacoes.map((item) => item.paciente_id).filter(Boolean))),
    [visibleSolicitacoes],
  );

  const { data: patientContext, isLoading: loadingPatients } = useQuery({
    queryKey: ['teleconsulta-patient-summaries', patientIds.join(',')],
    queryFn: () => getTeleconsultaContextRequest({
      patientIds,
      historyLimit: 1,
    }),
    enabled: patientIds.length > 0,
    staleTime: 60_000,
  });

  const patientLookup = useMemo(() => (
    Object.fromEntries(
      (patientContext?.patientSummaries || []).map((patient) => [patient.id, patient]),
    )
  ), [patientContext?.patientSummaries]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <ClipboardList className="h-4 w-4 text-emerald-500" />
          Servicos Extras
        </h3>
        <Badge className="bg-emerald-100 text-emerald-700">{visibleSolicitacoes.length}</Badge>
      </div>

      <div className="max-h-96 divide-y divide-border overflow-y-auto">
        {isLoading || loadingPatients ? (
          <div className="flex justify-center px-5 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : visibleSolicitacoes.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted-foreground">Nenhuma solicitacao pendente</p>
        ) : (
          visibleSolicitacoes.map((solicitacao) => {
            const patient = patientLookup[solicitacao.paciente_id] || null;
            const patientName = solicitacao.paciente_nome || patient?.fullName || 'Paciente';
            const mergedSolicitacao = {
              ...solicitacao,
              paciente_nome: patientName,
              paciente_sexo: patient?.sex || '',
              paciente_idade: formatAge(patient?.birthDate),
              doencas_previas: patient?.latestRiskHistory || '',
            };

            return (
              <div key={solicitacao.id} className="space-y-2 px-5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium text-foreground">{patientName}</span>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <NetAmountBadge amount={solicitacao.quoted_professional_net_amount} />
                    <Badge
                      variant="outline"
                      className={
                        solicitacao.tipo === 'renovacao_receitas'
                          ? 'border-violet-300 text-xs text-violet-700'
                          : 'border-emerald-300 text-xs text-emerald-700'
                      }
                    >
                      {solicitacao.tipo === 'renovacao_receitas' ? 'Renovacao de Receitas' : 'Check-Up'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  {solicitacao.tipo === 'renovacao_receitas' ? (
                    <>
                      <p>Medicamento: {mergedSolicitacao.nome_medicamento || 'Nao informado'}</p>
                      <p>Dosagem: {mergedSolicitacao.dosagem || 'Nao informado'}</p>
                      <p>Frequencia: {mergedSolicitacao.frequencia || 'Nao informado'}</p>
                      {mergedSolicitacao.arquivo_receita_url && (
                        <a
                          href={mergedSolicitacao.arquivo_receita_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-violet-600 hover:underline"
                        >
                          <Paperclip className="h-3 w-3 shrink-0" />
                          Ver receita anexada
                        </a>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="line-clamp-2">
                        Motivo: {mergedSolicitacao.motivo || 'Exames de rotina / check-up preventivo'}
                      </p>
                      <p>Sexo: {formatSexLabel(mergedSolicitacao.paciente_sexo)}</p>
                      <p>Idade: {mergedSolicitacao.paciente_idade}</p>
                      <p className="line-clamp-2">
                        Doencas previas: {mergedSolicitacao.doencas_previas || 'Nao informado'}
                      </p>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    {solicitacao.created_date ? format(new Date(solicitacao.created_date), 'dd/MM/yyyy HH:mm') : ''}
                  </span>
                  <Button
                    size="sm"
                    className="h-7 bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-700"
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
