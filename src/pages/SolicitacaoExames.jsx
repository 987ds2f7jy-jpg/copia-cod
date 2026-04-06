import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/components/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle, Loader2, Search } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import {
  buildSpecificExamSymptoms,
  createCheckupRequest,
  createSpecificExamRequest,
  persistSpecificExamRedirect,
} from '@/lib/solicitacoesExames';

function SolicitacaoExamesInner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [checkupOpen, setCheckupOpen] = useState(false);
  const [checkupConfirmed, setCheckupConfirmed] = useState(false);
  const [checkupLoading, setCheckupLoading] = useState(false);
  const [especificosOpen, setEspecificosOpen] = useState(false);
  const [exame, setExame] = useState('');
  const [motivo, setMotivo] = useState('');
  const [sintomas, setSintomas] = useState('');
  const [especificosLoading, setEspecificosLoading] = useState(false);

  async function handleCheckupSubmit() {
    if (!checkupConfirmed) {
      return;
    }

    setCheckupLoading(true);

    try {
      await createCheckupRequest(user);
      toast({
        title: 'Solicitacao enviada!',
        description: 'Seu pedido de Check-Up foi enviado para a fila direta do clinico geral.',
      });
      setCheckupOpen(false);
      setCheckupConfirmed(false);
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Nao foi possivel enviar a solicitacao.',
        variant: 'destructive',
      });
    } finally {
      setCheckupLoading(false);
    }
  }

  async function handleEspecificosSubmit() {
    if (!exame.trim()) {
      return;
    }

    setEspecificosLoading(true);

    try {
      await createSpecificExamRequest(user, {
        exame: exame.trim(),
        motivo: motivo.trim(),
        sintomas: sintomas.trim(),
      });

      const sintomasCompletos = buildSpecificExamSymptoms({
        exame: exame.trim(),
        motivo: motivo.trim(),
        sintomas: sintomas.trim(),
      });

      persistSpecificExamRedirect({
        especialidade: 'clinico_geral',
        sintomas: sintomasCompletos,
        exame: exame.trim(),
        motivo: motivo.trim(),
        descricao_original_sintomas: sintomas.trim(),
      });

      setEspecificosOpen(false);
      navigate(`/ConsultaAgora?especialidade=${encodeURIComponent('clinico_geral')}&sintomas=${encodeURIComponent(sintomasCompletos)}`);
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Nao foi possivel enviar a solicitacao.',
        variant: 'destructive',
      });
    } finally {
      setEspecificosLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Solicitacao de Exames</h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            Peca exames laboratoriais e de imagem com orientacao medica rapida e digital.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <Card
            className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-2 border-emerald-200 bg-emerald-50/50"
            onClick={() => setCheckupOpen(true)}
          >
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Check-Up</h3>
              <p className="text-sm text-gray-600">Pacote de exames essenciais de rotina.</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-2 border-blue-200 bg-blue-50/50"
            onClick={() => setEspecificosOpen(true)}
          >
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-5">
                <Search className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Exames Especificos</h3>
              <p className="text-sm text-gray-600">Solicite exames com orientacao medica e siga para o plantao.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={checkupOpen} onOpenChange={setCheckupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirmacao de Check-Up
            </DialogTitle>
            <DialogDescription>Leia com atencao antes de prosseguir.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 space-y-2">
              <p className="font-semibold">Atencao:</p>
              <p>Esta modalidade e exclusiva para pacientes assintomaticos no momento.</p>
              <p>Ela e indicada apenas para exames de rotina e check-up preventivo.</p>
              <p>
                Se voce estiver com dor, febre ou qualquer sintoma, use a opcao Exames Especificos para seguir ao plantao.
              </p>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Checkbox
                id="assintomatico"
                checked={checkupConfirmed}
                onCheckedChange={(value) => setCheckupConfirmed(Boolean(value))}
                className="mt-0.5"
              />
              <label htmlFor="assintomatico" className="text-sm text-gray-700 cursor-pointer leading-snug">
                Li e confirmo que estou assintomatico no momento.
              </label>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setCheckupOpen(false);
                  setCheckupConfirmed(false);
                }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={!checkupConfirmed || checkupLoading}
                onClick={handleCheckupSubmit}
              >
                {checkupLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Confirmar e Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={especificosOpen} onOpenChange={setEspecificosOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Exames Especificos</DialogTitle>
            <DialogDescription>Preencha os dados para solicitar o exame e seguir para o plantao.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Qual exame voce deseja solicitar?</label>
              <Input
                value={exame}
                onChange={(event) => setExame(event.target.value)}
                placeholder="Ex: Hemograma, Raio-X de torax..."
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Por que voce deseja solicitar este exame?</label>
              <Textarea
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                placeholder="Motivo da solicitacao..."
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Descreva seus sintomas ou a situacao de saude</label>
              <Textarea
                value={sintomas}
                onChange={(event) => setSintomas(event.target.value)}
                placeholder="Descreva seus sintomas..."
              />
            </div>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!exame.trim() || especificosLoading}
              onClick={handleEspecificosSubmit}
            >
              {especificosLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Solicitar ao Medico
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SolicitacaoExames() {
  return (
    <ProtectedRoute>
      <SolicitacaoExamesInner />
    </ProtectedRoute>
  );
}
