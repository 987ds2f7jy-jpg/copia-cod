import React, { useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Shield, ClipboardList, UserRound, Loader2, CheckCircle, Upload } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const FREQUENCIAS = [
  '1x ao dia',
  '2x ao dia',
  '3x ao dia',
  '4x ao dia',
  '5x ao dia',
  '6x ao dia',
];

export default function RenovacaoReceitas() {
  const { user } = useAuth();
  const [accepted, setAccepted] = useState(false);

  // Form state
  const [medicamento, setMedicamento] = useState('');
  const [dosagem, setDosagem] = useState('');
  const [frequencia, setFrequencia] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setArquivo(file);
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl('');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!medicamento.trim() || !dosagem.trim() || !frequencia || !arquivo) return;

    setLoading(true);
    try {
      // Upload file to storage
      const fileExt = arquivo.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, arquivo);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      // Create record
      await base44.entities.SolicitacaoExame.create({
        paciente_id: user?.id || '',
        paciente_nome: user?.full_name || user?.email || '',
        tipo: 'renovacao_receitas',
        exame_solicitado: '',
        motivo: '',
        sintomas: '',
        status: 'pending',
        assintomatico_confirmado: false,
        nome_medicamento: medicamento,
        dosagem: dosagem,
        frequencia: frequencia,
        arquivo_receita_url: publicUrl,
      });

      setSuccess(true);
      toast({ title: 'Solicitação enviada!', description: 'Seu pedido de renovação foi enviado para análise médica.' });
    } catch (err) {
      toast({ title: 'Erro', description: 'Não foi possível enviar a solicitação.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  const formValid = medicamento.trim() && dosagem.trim() && frequencia && arquivo;

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-lg mx-auto px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Solicitação Enviada!</h2>
          <p className="text-gray-600 mb-6">Seu pedido de renovação de receita foi enviado para análise médica. Você será notificado quando houver uma resposta.</p>
          <Button onClick={() => window.history.back()} variant="outline">Voltar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Renovação de Receitas</h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            Renove suas receitas de medicamentos de uso contínuo de forma rápida e digital, com envio direto ao médico.
          </p>
        </div>

        {!accepted ? (
          <Card className="border-0 shadow-md">
            <CardContent className="p-6 space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-4 text-sm text-amber-900">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Medicamentos não renovados</p>
                    <p>Não renovamos medicamentos tarja preta, antibióticos e terapias hormonais com esteroides androgênicos e anabolizantes.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ClipboardList className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Documentação obrigatória</p>
                    <p>É obrigatório anexar a prescrição anterior de forma legível para análise médica.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <UserRound className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Autonomia médica</p>
                    <p>O médico possui total autonomia para negar o pedido caso considere necessário.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Sua responsabilidade</p>
                    <p>Você é responsável pela veracidade das informações fornecidas ao médico.</p>
                  </div>
                </div>
              </div>

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-base"
                onClick={() => setAccepted(true)}
              >
                Confirmo que entendi as regras e desejo prosseguir com a renovação
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="medicamento">Nome do medicamento ou composto ativo *</Label>
                  <Input
                    id="medicamento"
                    value={medicamento}
                    onChange={e => setMedicamento(e.target.value)}
                    placeholder="Ex: Losartana, Metformina..."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dosagem">Dosagem do medicamento *</Label>
                  <Input
                    id="dosagem"
                    value={dosagem}
                    onChange={e => setDosagem(e.target.value)}
                    placeholder="Ex: 500mg, 1 comprimido..."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Frequência de uso *</Label>
                  <Select value={frequencia} onValueChange={setFrequencia}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a frequência" />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIAS.map(f => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="arquivo">Upload da última receita *</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-emerald-400 transition-colors cursor-pointer"
                    onClick={() => document.getElementById('arquivo').click()}
                  >
                    <input
                      type="file"
                      id="arquivo"
                      accept="image/jpeg,image/png,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {arquivo ? (
                      <div className="space-y-3">
                        {previewUrl && (
                          <img src={previewUrl} alt="Preview" className="max-h-48 mx-auto rounded-lg" />
                        )}
                        <p className="text-sm text-gray-700 font-medium">{arquivo.name}</p>
                        <p className="text-xs text-gray-500">Clique para trocar o arquivo</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                        <p className="text-sm text-gray-500">Clique para enviar (JPG, PNG ou PDF)</p>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-5 text-base"
                  disabled={!formValid || loading}
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Enviar Solicitação de Renovação
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
