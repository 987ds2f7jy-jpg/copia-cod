import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { getBackofficeServices, updateBackofficeService } from '../api/services';
import { useBackofficeAuth } from '../hooks/useBackofficeAuth';
import type { BackofficeServicePrice } from '../types';

const MAX_GROSS_PRICE = 9_999_999_999.99;

const groupLabels: Record<BackofficeServicePrice['fee_group'], string> = {
  duty: 'Plantão',
  specialty: 'Especialidade',
  services: 'Serviços clínicos',
};

function isAuthorizationError(error: unknown) {
  const status = Number((error as { status?: number })?.status || 0);
  return status === 401 || status === 403;
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return 'Sem término';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
}

function toPriceInput(value: number) {
  return value.toFixed(2).replace('.', ',');
}

function parsePriceInput(value: string) {
  const normalized = value.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(normalized)) return null;
  const price = Number(normalized.replace(',', '.'));
  if (!Number.isFinite(price) || price < 0 || price > MAX_GROSS_PRICE) return null;
  return price;
}

export function ServicesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logout } = useBackofficeAuth();
  const [editing, setEditing] = useState<BackofficeServicePrice | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [active, setActive] = useState(false);
  const [formError, setFormError] = useState('');

  const query = useQuery({
    queryKey: ['backoffice', 'services'],
    queryFn: getBackofficeServices,
  });

  useEffect(() => {
    if (query.error && isAuthorizationError(query.error)) logout();
  }, [logout, query.error]);

  const mutation = useMutation({
    mutationFn: updateBackofficeService,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['backoffice', 'services'] });
      setEditing(null);
      toast({
        title: 'Serviço atualizado',
        description: 'O novo valor e status serão usados nas próximas cotações elegíveis.',
      });
    },
    onError: (error) => {
      if (isAuthorizationError(error)) logout();
      setFormError(error instanceof Error ? error.message : 'Não foi possível atualizar o serviço.');
    },
  });

  function openEditor(service: BackofficeServicePrice) {
    setEditing(service);
    setPriceInput(toPriceInput(service.gross_price));
    setActive(service.active);
    setFormError('');
    mutation.reset();
  }

  function submitUpdate() {
    if (!editing || mutation.isPending) return;
    const grossPrice = parsePriceInput(priceInput);
    if (grossPrice === null) {
      setFormError('Informe um valor em reais, não negativo, com no máximo duas casas decimais.');
      return;
    }

    setFormError('');
    mutation.mutate({ servicePriceId: editing.id, grossPrice, active });
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Serviços</h2>
          <p className="mt-1 text-muted-foreground">Gerencie os valores em reais e a disponibilidade dos serviços da plataforma.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      <Card className="border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20">
        <CardContent className="p-4 text-sm text-amber-900 dark:text-amber-100">
          Alterações afetam novas cotações. Desativar um item ou ativá-lo com valor zero faz o fluxo de pricing existente tratá-lo como não configurado; snapshots financeiros já criados não são recalculados.
        </CardContent>
      </Card>

      {query.isLoading && (
        <div className="flex items-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando serviços...
        </div>
      )}

      {query.isError && !isAuthorizationError(query.error) && (
        <Card><CardContent className="p-6 text-destructive">{query.error instanceof Error ? query.error.message : 'Não foi possível carregar os serviços.'}</CardContent></Card>
      )}

      {!query.isLoading && !query.isError && query.data?.services.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum preço de serviço foi cadastrado.</CardContent></Card>
      )}

      {!query.isLoading && !query.isError && Boolean(query.data?.services.length) && (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Serviço</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Preço</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Vigência</th>
                  <th className="px-4 py-3 font-medium">Criado</th>
                  <th className="px-4 py-3 font-medium">Atualizado</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {query.data?.services.map((service) => (
                  <tr key={service.id}>
                    <td className="px-4 py-4">
                      <p className="font-medium">{service.display_name || service.service_code}</p>
                      <p className="text-xs text-muted-foreground">{service.service_code}{service.specialty_code ? ` · ${service.specialty_code}` : ''}</p>
                    </td>
                    <td className="px-4 py-4">{groupLabels[service.fee_group] || service.fee_group}</td>
                    <td className="px-4 py-4 font-medium">{formatCurrency(service.gross_price, service.currency)}</td>
                    <td className="px-4 py-4">
                      <Badge variant={service.active ? 'default' : 'secondary'}>{service.active ? 'Ativo' : 'Inativo'}</Badge>
                    </td>
                    <td className="px-4 py-4 text-xs">
                      <p>{formatDateTime(service.effective_from)}</p>
                      <p className="text-muted-foreground">até {formatDateTime(service.effective_to)}</p>
                    </td>
                    <td className="px-4 py-4 text-xs">{formatDateTime(service.created_at)}</td>
                    <td className="px-4 py-4 text-xs">{formatDateTime(service.updated_at)}</td>
                    <td className="px-4 py-4">
                      <Button size="sm" variant="outline" onClick={() => openEditor(service)}>
                        <Pencil className="h-4 w-4" /> Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && !mutation.isPending && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar serviço</DialogTitle>
            <DialogDescription>{editing?.display_name || editing?.service_code}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="service-gross-price">Preço em reais</Label>
              <Input
                id="service-gross-price"
                inputMode="decimal"
                autoComplete="off"
                value={priceInput}
                onChange={(event) => setPriceInput(event.target.value)}
                placeholder="100,00"
                disabled={mutation.isPending}
              />
              <p className="text-xs text-muted-foreground">Use até duas casas decimais. O banco armazena este valor como NUMERIC(12,2), não em centavos.</p>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border p-4">
              <div>
                <Label htmlFor="service-active">Serviço ativo</Label>
                <p className="mt-1 text-xs text-muted-foreground">Quando inativo, não participa de novas resoluções de preço.</p>
              </div>
              <Switch id="service-active" checked={active} onCheckedChange={setActive} disabled={mutation.isPending} />
            </div>

            {formError && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={mutation.isPending}>Cancelar</Button>
            <Button onClick={submitUpdate} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {mutation.isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
