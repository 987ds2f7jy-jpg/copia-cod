import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardList, Loader2, User } from 'lucide-react';
import { format } from 'date-fns';

export default function ServicosExtras({ professional, onAtender }) {
  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ['solicitacoes-exames'],
    queryFn: () => base44.entities.SolicitacaoExame.filter({ status: 'pending' }, '-created_date'),
    refetchInterval: 15000,
  });

  const pendingCount = solicitacoes.length;

  return (
    <div className="bg-white rounded-xl shadow-sm border-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-emerald-500" />
          Serviços Extras
        </h3>
        <Badge className="bg-emerald-100 text-emerald-700">{pendingCount}</Badge>
      </div>
      <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="px-5 py-6 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : solicitacoes.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400 text-center">Nenhuma solicitação pendente</p>
        ) : solicitacoes.map(s => (
          <div key={s.id} className="px-5 py-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <User className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm font-medium text-gray-800 truncate">{s.paciente_nome || 'Paciente'}</span>
              </div>
              <Badge variant="outline" className={
                s.tipo === 'checkup' ? 'border-emerald-300 text-emerald-700 text-xs'
                : s.tipo === 'renovacao_receitas' ? 'border-violet-300 text-violet-700 text-xs'
                : 'border-blue-300 text-blue-700 text-xs'
              }>
                {s.tipo === 'checkup' ? 'Check-Up' : s.tipo === 'renovacao_receitas' ? 'Renovação de Receitas' : 'Exames Específicos'}
              </Badge>
            </div>
            {s.tipo === 'renovacao_receitas' ? (
              <>
                {s.nome_medicamento && <p className="text-xs text-gray-500">Medicamento: {s.nome_medicamento} {s.dosagem && `- ${s.dosagem}`}</p>}
                {s.frequencia && <p className="text-xs text-gray-500">Frequência: {s.frequencia}</p>}
                {s.arquivo_receita_url && (
                  <a href={s.arquivo_receita_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                    📎 Ver receita anterior
                  </a>
                )}
              </>
            ) : (
              <>
                {s.exame_solicitado && <p className="text-xs text-gray-500">Exame: {s.exame_solicitado}</p>}
                {s.motivo && <p className="text-xs text-gray-500 line-clamp-1">Motivo: {s.motivo}</p>}
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {s.created_date ? format(new Date(s.created_date), 'dd/MM/yyyy HH:mm') : ''}
              </span>
              <Button
                size="sm"
                className="text-xs px-3 h-7 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => onAtender?.(s)}
              >
                Atender Solicitação
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
