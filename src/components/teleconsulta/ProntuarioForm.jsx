import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Save, CheckCircle } from 'lucide-react';

const FIELDS_COMPLETO = [
  { key: 'motivo_consulta', label: 'Motivo da Consulta', required: true },
  { key: 'historico_risco', label: 'Histórico e Fatores de Risco', required: false },
  { key: 'exames_imagem', label: 'Exames / Imagens', required: false },
  { key: 'exame_fisico', label: 'Exame Físico', required: false },
  { key: 'avaliacao_diagnostico', label: 'Avaliação Diagnóstica', required: false },
  { key: 'recomendacoes', label: 'Recomendações e Conduta', required: true },
];
const FIELDS_SIMPLES = [
  { key: 'motivo_consulta', label: 'Motivo da Consulta', required: true },
  { key: 'recomendacoes', label: 'Recomendações e Conduta', required: true },
];

export default function ProntuarioForm({ consultaId, pacienteId, profissionalId }) {
  const queryClient = useQueryClient();
  const [modo, setModo] = useState('completo');
  const [form, setForm] = useState({
    motivo_consulta: '', historico_risco: '', exames_imagem: '',
    exame_fisico: '', avaliacao_diagnostico: '', recomendacoes: '',
  });
  const [saved, setSaved] = useState(false);

  // Carregar prontuário existente desta consulta
  const { data: existente } = useQuery({
    queryKey: ['prontuario', consultaId],
    queryFn: async () => {
      const results = await base44.entities.Prontuario.filter({ consulta_id: consultaId });
      return results?.[0] || null;
    },
    enabled: !!consultaId,
  });

  useEffect(() => {
    if (existente) {
      setForm({
        motivo_consulta: existente.motivo_consulta || '',
        historico_risco: existente.historico_risco || '',
        exames_imagem: existente.exames_imagem || '',
        exame_fisico: existente.exame_fisico || '',
        avaliacao_diagnostico: existente.avaliacao_diagnostico || '',
        recomendacoes: existente.recomendacoes || '',
      });
      setModo(existente.modo || 'completo');
    }
  }, [existente?.id]);

  const salvar = useMutation({
    mutationFn: async () => {
      const data = { ...form, consulta_id: consultaId, paciente_id: pacienteId, profissional_id: profissionalId, modo };
      if (existente?.id) {
        return base44.entities.Prontuario.update(existente.id, data);
      }
      return base44.entities.Prontuario.create(data);
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['prontuario', consultaId] });
    },
  });

  const campos = modo === 'completo' ? FIELDS_COMPLETO : FIELDS_SIMPLES;

  return (
    <div className="space-y-3">
      {/* Toggle modo */}
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
        {['completo', 'simples'].map(m => (
          <button
            key={m}
            onClick={() => setModo(m)}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
              modo === m ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Campos */}
      {campos.map(({ key, label, required }) => (
        <div key={key}>
          <Label className="text-xs text-gray-300 mb-1 block">
            {label} {required && <span className="text-red-400">*</span>}
          </Label>
          <Textarea
            value={form[key]}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            placeholder={label}
            className="text-xs min-h-[60px] bg-gray-800 border-gray-700 text-gray-100 placeholder:text-gray-500 resize-none"
            rows={2}
          />
        </div>
      ))}

      <Button
        onClick={() => salvar.mutate()}
        disabled={!form.motivo_consulta || !form.recomendacoes || salvar.isPending}
        className={`w-full text-xs h-9 ${saved ? 'bg-green-600 hover:bg-green-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
      >
        {salvar.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> :
         saved ? <CheckCircle className="w-3.5 h-3.5 mr-1" /> :
         <Save className="w-3.5 h-3.5 mr-1" />}
        {saved ? 'Salvo!' : 'Salvar Prontuário'}
      </Button>
    </div>
  );
}