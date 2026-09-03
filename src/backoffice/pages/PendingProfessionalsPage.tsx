import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getPendingProfessionals, reviewPendingProfessional } from '../api/pendingProfessionals';
import { useBackofficeAuth } from '../hooks/useBackofficeAuth';
import type { PendingProfessional } from '../types';

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
}

export function PendingProfessionalsPage() {
  const queryClient = useQueryClient();
  const { logout } = useBackofficeAuth();
  const [review, setReview] = useState<{ professional: PendingProfessional; action: 'approve' | 'reject' } | null>(null);
  const query = useQuery({ queryKey: ['backoffice', 'pending-professionals'], queryFn: getPendingProfessionals });
  const mutation = useMutation({
    mutationFn: reviewPendingProfessional,
    onSuccess: () => {
      setReview(null);
      queryClient.invalidateQueries({ queryKey: ['backoffice', 'pending-professionals'] });
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
    },
    onError: (error) => {
      const status = Number((error as { status?: number })?.status || 0);
      if (status === 401 || status === 403) logout();
    },
  });

  function confirmReview() {
    if (!review) return;
    mutation.mutate({ professionalProfileId: review.professional.id, action: review.action });
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Cadastros pendentes</h2>
          <p className="mt-1 text-muted-foreground">Profissionais aguardando decisão administrativa.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      {query.isLoading && <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Carregando cadastros...</div>}
      {query.isError && <Card><CardContent className="p-6 text-destructive">{query.error instanceof Error ? query.error.message : 'Não foi possível carregar os cadastros.'}</CardContent></Card>}
      {!query.isLoading && !query.isError && query.data?.professionals.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">Não há cadastros pendentes.</CardContent></Card>}
      {!query.isLoading && !query.isError && Boolean(query.data?.professionals.length) && (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-muted/60 text-muted-foreground"><tr>
                <th className="px-4 py-3 font-medium">Profissional</th><th className="px-4 py-3 font-medium">Especialidade</th><th className="px-4 py-3 font-medium">Registro</th><th className="px-4 py-3 font-medium">Contato</th><th className="px-4 py-3 font-medium">Cadastro</th><th className="px-4 py-3 font-medium">Ações</th>
              </tr></thead>
              <tbody className="divide-y">
                {query.data?.professionals.map((professional) => (
                  <tr key={professional.id}>
                    <td className="px-4 py-4"><p className="font-medium">{professional.full_name}</p><p className="text-xs text-muted-foreground">{professional.profession} · CPF: {professional.cpf || 'não informado'}</p></td>
                    <td className="px-4 py-4">{professional.specialty}</td>
                    <td className="px-4 py-4">{professional.register_number}/{professional.register_state}</td>
                    <td className="px-4 py-4">{professional.phone || 'não informado'}</td>
                    <td className="px-4 py-4">{formatDate(professional.created_date)}</td>
                    <td className="px-4 py-4"><div className="flex gap-2"><Button size="sm" disabled={mutation.isPending} onClick={() => setReview({ professional, action: 'approve' })}><Check /> Aprovar</Button><Button size="sm" variant="destructive" disabled={mutation.isPending} onClick={() => setReview({ professional, action: 'reject' })}><X /> Reprovar</Button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AlertDialog open={Boolean(review)} onOpenChange={(open) => !open && !mutation.isPending && setReview(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{review?.action === 'approve' ? 'Aprovar profissional?' : 'Reprovar profissional?'}</AlertDialogTitle><AlertDialogDescription>Esta decisão atualizará o cadastro de {review?.professional.full_name} e será registrada na auditoria do backoffice.</AlertDialogDescription></AlertDialogHeader>
          {mutation.isError && <p className="text-sm text-destructive">{mutation.error instanceof Error ? mutation.error.message : 'Não foi possível concluir a revisão.'}</p>}
          <AlertDialogFooter><AlertDialogCancel disabled={mutation.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={mutation.isPending} onClick={confirmReview}>{mutation.isPending ? 'Salvando...' : review?.action === 'approve' ? 'Aprovar' : 'Reprovar'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
