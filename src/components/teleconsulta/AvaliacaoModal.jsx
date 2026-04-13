import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Loader2, Star } from 'lucide-react';
import { submitConsultaEvaluationRequest } from '@/client-api/teleconsulta';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';

export default function AvaliacaoModal({
  open,
  consultationId,
  professionalName = '',
  existingEvaluation = null,
  canSubmit = true,
  onClose,
  onSubmitted,
}) {
  const queryClient = useQueryClient();
  const [nota, setNota] = useState(existingEvaluation?.rating || existingEvaluation?.nota || 5);
  const [comentario, setComentario] = useState(existingEvaluation?.comment || existingEvaluation?.comentario || '');
  const [done, setDone] = useState(Boolean(existingEvaluation));
  const [submittedNow, setSubmittedNow] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setNota(existingEvaluation?.rating || existingEvaluation?.nota || 5);
    setComentario(existingEvaluation?.comment || existingEvaluation?.comentario || '');
    setDone(Boolean(existingEvaluation));
    setSubmittedNow(false);
  }, [existingEvaluation?.id, open]);

  useEffect(() => {
    if (!open || !done || !submittedNow || typeof onSubmitted !== 'function') {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      onSubmitted();
    }, 1400);

    return () => window.clearTimeout(timeoutId);
  }, [done, onSubmitted, open, submittedNow]);

  const salvar = useMutation({
    mutationFn: () => submitConsultaEvaluationRequest({
      consultationId,
      rating: nota,
      comment: comentario.trim(),
    }),
    onSuccess: async () => {
      setDone(true);
      setSubmittedNow(true);
      await queryClient.invalidateQueries({ queryKey: ['teleconsulta-context', consultationId] });
      toast({
        title: 'Feedback enviado com sucesso.',
        description: 'Obrigado pela sua avaliação.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao enviar a avaliacao',
        description: error?.message || 'Nao foi possivel enviar a avaliacao.',
        variant: 'destructive',
      });
    },
  });

  const handleClose = () => {
    if (done && typeof onSubmitted === 'function') {
      onSubmitted();
      return;
    }

    if (typeof onClose === 'function') {
      onClose();
    }
  };

  if (done) {
    return (
      <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
        <DialogContent className="text-center">
          <CheckCircle className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
          <h3 className="text-lg font-semibold text-gray-900">Obrigado pela avaliacao!</h3>
          <p className="mb-4 text-sm text-gray-500">
            {submittedNow ? 'Seu feedback foi enviado. Redirecionando...' : 'Seu feedback e muito importante.'}
          </p>
          <Button
            onClick={handleClose}
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {submittedNow ? 'Ir agora' : 'Voltar ao inicio'}
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Avaliar consulta</DialogTitle>
          <DialogDescription>
            Como foi sua experiencia com Dr(a). {professionalName || 'seu profissional'}?
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Nota</p>
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setNota(value)}
                  className="p-1"
                  disabled={!canSubmit}
                >
                  <Star
                    className={`h-9 w-9 transition-colors ${
                      value <= nota ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">Comentario (opcional)</p>
            <Textarea
              value={comentario}
              onChange={(event) => setComentario(event.target.value)}
              placeholder="Conte como foi sua experiencia..."
              className="min-h-[80px]"
              disabled={!canSubmit}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Pular
            </Button>
            <Button
              onClick={() => salvar.mutate()}
              disabled={!canSubmit || !consultationId || salvar.isPending}
              className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {salvar.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Enviar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
