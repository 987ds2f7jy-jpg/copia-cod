import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthContext';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { ClipboardList, Search, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

export default function SolicitacaoExames() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Check-Up modal
  const [checkupOpen, setCheckupOpen] = useState(false);
  const [checkupConfirmed, setCheckupConfirmed] = useState(false);
  const [checkupLoading, setCheckupLoading] = useState(false);

  // Exames Específicos modal
  const [especificosOpen, setEspecificosOpen] = useState(false);
  const [exame, setExame] = useState('');
  const [motivo, setMotivo] = useState('');
  const [sintomas, setSintomas] = useState('');
  const [especificosLoading, setEspecificosLoading] = useState(false);

  async function handleCheckupSubmit() {
    if (!checkupConfirmed) return;
    setCheckupLoading(true);
    try {
      await base44.entities.SolicitacaoExame.create({
        paciente_id: user?.id || '',
        paciente_nome: user?.full_name || user?.email || '',
        tipo: 'checkup',
        exame_solicitado: 'Check-Up Completo',
        motivo: 'Exames de rotina / check-up preventivo',
        sintomas: '',
        status: 'pending',
        assintomatico_confirmado: true,
      });
      toast({ title: 'Solicitação enviada!', description: 'Seu pedido de Check-Up foi enviado para um médico.' });
      setCheckupOpen(false);
      setCheckupConfirmed(false);
    } catch (err) {
      toast({ title: 'Erro', description: 'Não foi possível enviar a solicitação.', variant: 'destructive' });
    } finally {
      setCheckupLoading(false);
    }
  }

  async function handleEspecificosSubmit() {
    if (!exame.trim()) return;
    setEspecificosLoading(true);
    try {
      await base44.entities.SolicitacaoExame.create({
        paciente_id: user?.id || '',
        paciente_nome: user?.full_name || user?.email || '',
        tipo: 'especificos',
        exame_solicitado: exame,
        motivo: motivo,
        sintomas: sintomas,
        status: 'pending',
        assintomatico_confirmado: false,
      });
      // Redirect to ConsultaAgora with symptoms pre-filled (Clínica Geral queue)
      const sintomasCompletos = `[Solicitação de Exame: ${exame}] Motivo: ${motivo}. Sintomas: ${sintomas}`;
      navigate(`/ConsultaAgora?especialidade=${encodeURIComponent('Clínico Geral')}&sintomas=${encodeURIComponent(sintomasCompletos)}`);
    } catch (err) {
      toast({ title: 'Erro', description: 'Não foi possível enviar a solicitação.', variant: 'destructive' });
    } finally {
      setEspecificosLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Solicitação de Exames</h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            Peça exames laboratoriais e de imagem com orientação médica rápida e digital.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {/* Check-Up Card */}
          <Card
            className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-2 border-emerald-200 bg-emerald-50/50"
            onClick={() => setCheckupOpen(true)}
          >
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">✅ Check-Up</h3>
              <p className="text-sm text-gray-600">Pacote de exames essenciais de rotina</p>
            </CardContent>
          </Card>

          {/* Exames Específicos Card */}
          <Card
            className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-2 border-blue-200 bg-blue-50/50"
            onClick={() => setEspecificosOpen(true)}
          >
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-5">
                <Search className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">🔍 Exames Específicos</h3>
              <p className="text-sm text-gray-600">Solicite exames com orientação médica</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Check-Up Confirmation Modal */}
      <Dialog open={checkupOpen} onOpenChange={setCheckupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirmação de Check-Up
            </DialogTitle>
            <DialogDescription>Leia com atenção antes de prosseguir.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 space-y-2">
              <p className="font-semibold">⚠️ Atenção:</p>
              <p>Esta modalidade é exclusiva para pacientes <strong>assintomáticos</strong> (sem sintomas atuais).</p>
              <p>É indicada apenas para exames de rotina/check-up preventivo.</p>
              <p>Se você está com dor, febre ou qualquer sintoma, por favor use a opção <strong>"Exames Específicos"</strong> ou agende uma consulta normal.</p>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Checkbox
                id="assintomatico"
                checked={checkupConfirmed}
                onCheckedChange={(v) => setCheckupConfirmed(!!v)}
                className="mt-0.5"
              />
              <label htmlFor="assintomatico" className="text-sm text-gray-700 cursor-pointer leading-snug">
                Li e confirmo que estou assintomático no momento.
              </label>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setCheckupOpen(false); setCheckupConfirmed(false); }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={!checkupConfirmed || checkupLoading}
                onClick={handleCheckupSubmit}
              >
                {checkupLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Confirmar e Enviar Solicitação
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Exames Específicos Modal */}
      <Dialog open={especificosOpen} onOpenChange={setEspecificosOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Exames Específicos</DialogTitle>
            <DialogDescription>Preencha os dados para solicitar ao médico.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Qual exame você deseja solicitar?</label>
              <Input value={exame} onChange={e => setExame(e.target.value)} placeholder="Ex: Hemograma, Raio-X de tórax..." />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Por que você deseja solicitar este exame?</label>
              <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo da solicitação..." />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Descreva seus sintomas ou situação de saúde</label>
              <Textarea value={sintomas} onChange={e => setSintomas(e.target.value)} placeholder="Descreva seus sintomas..." />
            </div>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!exame.trim() || especificosLoading}
              onClick={handleEspecificosSubmit}
            >
              {especificosLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Solicitar ao Médico
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
