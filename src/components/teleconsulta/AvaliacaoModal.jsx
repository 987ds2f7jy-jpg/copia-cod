import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2, CheckCircle } from 'lucide-react';

export default function AvaliacaoModal({ open, consulta, pacienteId, onClose }) {
  const [nota, setNota] = useState(5);
  const [comentario, setComentario] = useState('');
  const [done, setDone] = useState(false);

  const salvar = useMutation({
    mutationFn: () => base44.entities.AvaliacaoConsulta.create({
      consulta_id: consulta?.id,
      paciente_id: pacienteId,
      profissional_id: consulta?.profissional_id,
      nota,
      comentario: comentario.trim() || undefined,
    }),
    onSuccess: () => setDone(true),
  });

  if (done) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="text-center">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900">Obrigado pela avaliação!</h3>
          <p className="text-gray-500 text-sm mb-4">Seu feedback é muito importante.</p>
          <Button onClick={onClose} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full">
            Voltar ao Início
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Avaliar Consulta</DialogTitle>
          <DialogDescription>
            Como foi sua experiência com Dr(a). {consulta?.profissional_nome}?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Nota</p>
            <div className="flex gap-1 justify-center">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => setNota(s)} className="p-1">
                  <Star className={`w-9 h-9 transition-colors ${s <= nota ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Comentário (opcional)</p>
            <Textarea
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              placeholder="Conte como foi sua experiência..."
              className="min-h-[80px]"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Pular</Button>
            <Button
              onClick={() => salvar.mutate()}
              disabled={salvar.isPending}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {salvar.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Enviar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}