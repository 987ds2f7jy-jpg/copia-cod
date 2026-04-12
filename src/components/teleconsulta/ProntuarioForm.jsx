import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Loader2, Save } from 'lucide-react';
import { upsertProntuarioRequest } from '@/client-api/teleconsulta';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import PreenchimentoAutomaticoProntuario from '@/components/teleconsulta/PreenchimentoAutomaticoProntuario';

const EMPTY_FORM = {
  motivo_consulta: '',
  historico_risco: '',
  exames_imagem: '',
  exame_fisico: '',
  avaliacao_diagnostico: '',
  recomendacoes: '',
};

const FIELDS_COMPLETO = [
  { key: 'motivo_consulta', label: 'Motivo da Consulta', required: true },
  { key: 'historico_risco', label: 'Historico e Fatores de Risco', required: false },
  { key: 'exames_imagem', label: 'Exames / Imagens', required: false },
  { key: 'exame_fisico', label: 'Exame Fisico', required: false },
  { key: 'avaliacao_diagnostico', label: 'Avaliacao Diagnostica', required: false },
  { key: 'recomendacoes', label: 'Recomendacoes e Conduta', required: true },
];

const FIELDS_SIMPLES = [
  { key: 'motivo_consulta', label: 'Motivo da Consulta', required: true },
  { key: 'recomendacoes', label: 'Recomendacoes e Conduta', required: true },
];

function toProntuarioFormState(prontuario) {
  if (!prontuario) {
    return EMPTY_FORM;
  }

  return {
    motivo_consulta: prontuario.motivoConsulta || prontuario.motivo_consulta || '',
    historico_risco: prontuario.historicoRisco || prontuario.historico_risco || '',
    exames_imagem: prontuario.examesImagem || prontuario.exames_imagem || '',
    exame_fisico: prontuario.exameFisico || prontuario.exame_fisico || '',
    avaliacao_diagnostico: prontuario.avaliacaoDiagnostico || prontuario.avaliacao_diagnostico || '',
    recomendacoes: prontuario.recomendacoes || '',
  };
}

export default function ProntuarioForm({
  consultationId,
  initialProntuario = null,
  canEdit = true,
  onSaved,
  showAutomaticFill = true,
  externalAutoFill = null,
  defaultMode = 'completo',
  mode = null,
  onModeChange,
}) {
  const queryClient = useQueryClient();
  const [modoInterno, setModoInterno] = useState(initialProntuario?.mode || initialProntuario?.modo || defaultMode);
  const [form, setForm] = useState(() => toProntuarioFormState(initialProntuario));
  const [saved, setSaved] = useState(false);
  const lastExternalAutoFillKeyRef = useRef(null);
  const modo = mode || modoInterno;

  useEffect(() => {
    setForm(toProntuarioFormState(initialProntuario));
    setModoInterno(initialProntuario?.mode || initialProntuario?.modo || defaultMode);
  }, [defaultMode, initialProntuario?.id, initialProntuario?.updatedAt, initialProntuario?.updated_at]);

  const campos = useMemo(
    () => (modo === 'completo' ? FIELDS_COMPLETO : FIELDS_SIMPLES),
    [modo],
  );

  const updateModo = (nextModo) => {
    setModoInterno(nextModo);

    if (typeof onModeChange === 'function') {
      onModeChange(nextModo);
    }
  };

  const salvar = useMutation({
    mutationFn: () => upsertProntuarioRequest({
      consultationId,
      mode: modo,
      motivoConsulta: form.motivo_consulta,
      historicoRisco: form.historico_risco,
      examesImagem: form.exames_imagem,
      exameFisico: form.exame_fisico,
      avaliacaoDiagnostico: form.avaliacao_diagnostico,
      recomendacoes: form.recomendacoes,
    }),
    onSuccess: async (result) => {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);

      await queryClient.invalidateQueries({ queryKey: ['teleconsulta-context', consultationId] });

      if (typeof onSaved === 'function') {
        onSaved(result);
      }

      toast({
        title: result?.created ? 'Prontuario criado com sucesso.' : 'Prontuario atualizado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao salvar o prontuario',
        description: error?.message || 'Nao foi possivel salvar o prontuario.',
        variant: 'destructive',
      });
    },
  });

  const disabled = !consultationId || !canEdit || salvar.isPending;

  const applyAutomatico = (autoFilledFields) => {
    updateModo('completo');
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

  useEffect(() => {
    if (!externalAutoFill?.key || !externalAutoFill?.fields) {
      return;
    }

    if (lastExternalAutoFillKeyRef.current === externalAutoFill.key) {
      return;
    }

    lastExternalAutoFillKeyRef.current = externalAutoFill.key;
    applyAutomatico(externalAutoFill.fields);
  }, [externalAutoFill]);

  return (
    <div className="space-y-3">
      {showAutomaticFill && modo === 'completo' ? (
        <div className="space-y-3">
          {/* Mantido como fallback padrao para usos fora da teleconsulta principal */}
          <PreenchimentoAutomaticoProntuario
            consultationId={consultationId}
            disabled={disabled}
            onApply={applyAutomatico}
          />
        </div>
      ) : null}

      <div className="flex gap-1 rounded-lg bg-gray-800 p-1">
        {['completo', 'simples'].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => updateModo(value)}
            disabled={!canEdit}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition-colors ${
              modo === value ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-gray-200'
            } ${!canEdit ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            {value}
          </button>
        ))}
      </div>

      {campos.map(({ key, label, required }) => (
        <div key={key}>
          <Label className="mb-1 block text-xs text-gray-300">
            {label} {required && <span className="text-red-400">*</span>}
          </Label>
          <Textarea
            value={form[key]}
            onChange={(event) => {
              setSaved(false);
              setForm((current) => ({ ...current, [key]: event.target.value }));
            }}
            placeholder={label}
            disabled={!canEdit}
            className="min-h-[60px] resize-none border-gray-700 bg-gray-800 text-xs text-gray-100 placeholder:text-gray-500"
            rows={2}
          />
        </div>
      ))}

      <Button
        type="button"
        onClick={() => salvar.mutate()}
        disabled={!form.motivo_consulta.trim() || !form.recomendacoes.trim() || disabled}
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
        {saved ? 'Salvo!' : 'Salvar prontuario'}
      </Button>
    </div>
  );
}
