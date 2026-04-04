import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import PreenchimentoAutomaticoProntuario from '@/components/teleconsulta/PreenchimentoAutomaticoProntuario';

const FIELDS_COMPLETO = [
  { key: 'motivo_consulta', name: 'motivo_da_consulta', label: 'Motivo da Consulta', required: true },
  { key: 'historico_risco', name: 'historico_e_fatores_de_risco', label: 'Historico e Fatores de Risco', required: false },
  { key: 'exames_imagem', name: 'exames_imagens', label: 'Exames / Imagens', required: false },
  { key: 'exame_fisico', name: 'exame_fisico', label: 'Exame Fisico', required: false },
  { key: 'avaliacao_diagnostico', name: 'avaliacao_diagnostica', label: 'Avaliacao Diagnostica', required: false },
  { key: 'recomendacoes', name: 'recomendacoes_e_conduta', label: 'Recomendacoes e Conduta', required: true },
];

const FIELDS_SIMPLES = [
  { key: 'motivo_consulta', name: 'motivo_da_consulta', label: 'Motivo da Consulta', required: true },
  { key: 'recomendacoes', name: 'recomendacoes_e_conduta', label: 'Recomendacoes e Conduta', required: true },
];

export default function ProntuarioForm({ consultaId, pacienteId, profissionalId }) {
  const queryClient = useQueryClient();
  const [modo, setModo] = useState('completo');
  const [form, setForm] = useState({
    motivo_consulta: '',
    historico_risco: '',
    exames_imagem: '',
    exame_fisico: '',
    avaliacao_diagnostico: '',
    recomendacoes: '',
  });
  const [saved, setSaved] = useState(false);

  const applyAutomatico = (autoFilledFields) => {
    setModo('completo');
    setSaved(false);
    setForm((current) => ({
      ...current,
      motivo_consulta: autoFilledFields.motivo_da_consulta || current.motivo_consulta,
      historico_risco: autoFilledFields.historico_e_fatores_de_risco || current.historico_risco,
      exames_imagem: autoFilledFields.exames_imagens || current.exames_imagem,
      exame_fisico: autoFilledFields.exame_fisico || current.exame_fisico,
      avaliacao_diagnostico: autoFilledFields.avaliacao_diagnostica || current.avaliacao_diagnostico,
      recomendacoes: autoFilledFields.recomendacoes_e_conduta || current.recomendacoes,
    }));
  };

  const { data: existente } = useQuery({
    queryKey: ['prontuario', consultaId],
    queryFn: async () => {
      const results = await base44.entities.Prontuario.filter({ consulta_id: consultaId });
      return results?.[0] || null;
    },
    enabled: !!consultaId,
  });

  useEffect(() => {
    if (!existente) {
      return;
    }

    setForm({
      motivo_consulta: existente.motivo_consulta || '',
      historico_risco: existente.historico_risco || '',
      exames_imagem: existente.exames_imagem || '',
      exame_fisico: existente.exame_fisico || '',
      avaliacao_diagnostico: existente.avaliacao_diagnostico || '',
      recomendacoes: existente.recomendacoes || '',
    });
    setModo(existente.modo || 'completo');
  }, [existente?.id]);

  const salvar = useMutation({
    mutationFn: async () => {
      const data = {
        ...form,
        consulta_id: consultaId,
        paciente_id: pacienteId,
        profissional_id: profissionalId,
        modo,
      };

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
      <PreenchimentoAutomaticoProntuario
        disabled={!consultaId || salvar.isPending}
        onApply={applyAutomatico}
      />

      <div className="flex gap-1 rounded-lg bg-gray-800 p-1">
        {['completo', 'simples'].map((m) => (
          <button
            key={m}
            onClick={() => setModo(m)}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition-colors ${
              modo === m ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {campos.map(({ key, name, label, required }) => (
        <div key={key}>
          <Label className="mb-1 block text-xs text-gray-300">
            {label} {required && <span className="text-red-400">*</span>}
          </Label>
          <Textarea
            name={name}
            value={form[key]}
            onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
            placeholder={label}
            className="min-h-[60px] resize-none border-gray-700 bg-gray-800 text-xs text-gray-100 placeholder:text-gray-500"
            rows={2}
          />
        </div>
      ))}

      <Button
        onClick={() => salvar.mutate()}
        disabled={!form.motivo_consulta || !form.recomendacoes || salvar.isPending}
        className={`h-9 w-full text-xs ${
          saved ? 'bg-green-600 hover:bg-green-600' : 'bg-emerald-600 hover:bg-emerald-700'
        }`}
      >
        {salvar.isPending ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : saved ? (
          <CheckCircle className="mr-1 h-3.5 w-3.5" />
        ) : (
          <Save className="mr-1 h-3.5 w-3.5" />
        )}
        {saved ? 'Salvo!' : 'Salvar Prontuario'}
      </Button>
    </div>
  );
}
