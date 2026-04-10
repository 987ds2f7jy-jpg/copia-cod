import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getTeleconsultaContextRequest } from '@/client-api/teleconsulta';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function ProntuarioItem({ prontuario }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-700">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="w-full bg-gray-800 p-3 text-left hover:bg-gray-750"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">{prontuario.motivoConsulta || 'Sem resumo'}</p>
            <p className="mt-0.5 text-xs text-gray-400">
              {prontuario.createdAt
                ? format(new Date(prontuario.createdAt), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })
                : '-'}
            </p>
          </div>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="space-y-2 bg-gray-900 p-3">
          {[
            ['Historico de risco', prontuario.historicoRisco],
            ['Exames / imagens', prontuario.examesImagem],
            ['Exame fisico', prontuario.exameFisico],
            ['Avaliacao diagnostica', prontuario.avaliacaoDiagnostico],
            ['Recomendacoes', prontuario.recomendacoes],
          ]
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label}>
                <p className="text-xs font-medium text-emerald-400">{label}</p>
                <p className="mt-0.5 whitespace-pre-wrap text-xs text-gray-300">{value}</p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default function ProntuariosAnteriores({
  open,
  onClose,
  patientId,
  excludeConsultationId = null,
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['teleconsulta-history', patientId, excludeConsultationId],
    queryFn: () => getTeleconsultaContextRequest({
      patientId,
      historyLimit: 20,
      excludeConsultationId,
    }),
    enabled: open && Boolean(patientId),
    staleTime: 30_000,
  });

  const prontuarios = data?.recentProntuarios || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg border-gray-700 bg-gray-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <FileText className="h-4 w-4 text-emerald-400" />
            Prontuarios anteriores
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 max-h-[60vh] space-y-2 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : prontuarios.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Nenhum prontuario anterior</p>
          ) : (
            prontuarios.map((prontuario) => (
              <ProntuarioItem key={prontuario.id} prontuario={prontuario} />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
