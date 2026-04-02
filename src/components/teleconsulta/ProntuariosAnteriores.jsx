import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, FileText, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function ProntuarioItem({ prontuario }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-750 text-left"
      >
        <div>
          <p className="text-sm font-medium text-white">{prontuario.motivo_consulta}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {prontuario.created_date ? format(new Date(prontuario.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="p-3 bg-gray-900 space-y-2">
          {[
            ['Histórico de Risco', prontuario.historico_risco],
            ['Exames / Imagens', prontuario.exames_imagem],
            ['Exame Físico', prontuario.exame_fisico],
            ['Avaliação Diagnóstica', prontuario.avaliacao_diagnostico],
            ['Recomendações', prontuario.recomendacoes],
          ].filter(([, v]) => v).map(([label, val]) => (
            <div key={label}>
              <p className="text-xs font-medium text-emerald-400">{label}</p>
              <p className="text-xs text-gray-300 mt-0.5 whitespace-pre-wrap">{val}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProntuariosAnteriores({ open, onClose, pacienteId }) {
  const { data: prontuarios = [], isLoading } = useQuery({
    queryKey: ['prontuariosAnteriores', pacienteId],
    queryFn: () => base44.entities.Prontuario.filter({ paciente_id: pacienteId }, '-created_date', 20),
    enabled: open && !!pacienteId,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            Prontuários Anteriores
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-2 mt-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : prontuarios.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhum prontuário anterior</p>
          ) : (
            prontuarios.map(p => <ProntuarioItem key={p.id} prontuario={p} />)
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}