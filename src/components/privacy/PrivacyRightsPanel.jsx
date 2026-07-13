import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import {
  createPrivacyRightsRequest,
  generateMyPrivacyDataExport,
  getMyPrivacyRightsRequests,
} from '@/client-api/account';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const TYPE_LABELS = {
  access: 'Acesso aos meus dados',
  export: 'Exportacao dos meus dados',
  correction: 'Correcao de dados',
  account_deactivation: 'Desativacao com analise administrativa',
  deletion_or_anonymization: 'Exclusao ou anonimizacao',
  consent_information: 'Informacoes sobre consentimentos',
};

const STATUS_LABELS = {
  submitted: 'Enviada',
  in_review: 'Em analise',
  awaiting_user: 'Aguardando voce',
  approved: 'Aprovada',
  partially_approved: 'Parcialmente aprovada',
  rejected: 'Nao aprovada',
  completed: 'Concluida',
  canceled: 'Cancelada',
};

function createIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return `privacy:${globalThis.crypto.randomUUID()}`;
  return `privacy:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export default function PrivacyRightsPanel() {
  const queryClient = useQueryClient();
  const [requestType, setRequestType] = useState('access');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');

  const requestsQuery = useQuery({
    queryKey: ['privacy-rights-requests'],
    queryFn: () => getMyPrivacyRightsRequests({ page: 1, pageSize: 20 }),
  });

  const createRequest = useMutation({
    mutationFn: () => createPrivacyRightsRequest({
      requestType,
      description,
      idempotencyKey: createIdempotencyKey(),
    }),
    onSuccess: (result) => {
      setDescription('');
      setMessage(result?.created === false ? 'Ja existe uma solicitacao aberta equivalente.' : 'Solicitacao registrada com seguranca.');
      queryClient.invalidateQueries({ queryKey: ['privacy-rights-requests'] });
    },
    onError: (error) => setMessage(error?.message || 'Nao foi possivel registrar a solicitacao.'),
  });

  const generateExport = useMutation({
    mutationFn: (requestId) => generateMyPrivacyDataExport(requestId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['privacy-rights-requests'] });
      if (result?.downloadUrl) window.location.assign(result.downloadUrl);
    },
    onError: (error) => setMessage(error?.message || 'Nao foi possivel gerar a exportacao.'),
  });

  const items = requestsQuery.data?.items || [];

  return (
    <section className="mt-8 border-t border-border pt-6" aria-labelledby="privacy-rights-title">
      <div className="mb-5 flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
        <div>
          <h2 id="privacy-rights-title" className="text-base font-semibold text-foreground">Privacidade e seus dados</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Desativar a conta nao equivale a excluir dados. Prontuarios, documentos medicos,
            registros financeiros, juridicos e de seguranca podem precisar ser preservados.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="privacy-request-type">Tipo de solicitacao</Label>
          <Select value={requestType} onValueChange={setRequestType}>
            <SelectTrigger id="privacy-request-type" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="privacy-request-description">Detalhes necessarios</Label>
          <Textarea
            id="privacy-request-description"
            value={description}
            maxLength={2000}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Descreva objetivamente o pedido. Nao inclua prontuario, diagnostico ou documentos medicos."
            className="mt-1 min-h-24"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Prazo de atendimento: (VALIDAR E DEFINIR COM RESPONSAVEL JURIDICO/PRIVACIDADE).
          Solicitacoes repetidas podem exigir validacao adicional.
        </p>

        {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}

        <Button type="button" onClick={() => createRequest.mutate()} disabled={createRequest.isPending}>
          {createRequest.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Enviar solicitacao
        </Button>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">Solicitacoes anteriores</h3>
          <Button type="button" size="icon" variant="ghost" onClick={() => requestsQuery.refetch()} aria-label="Atualizar solicitacoes">
            <RefreshCw className={`h-4 w-4 ${requestsQuery.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {requestsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando solicitacoes...</p>
        ) : requestsQuery.isError ? (
          <p className="text-sm text-red-600 dark:text-red-300">Nao foi possivel carregar as solicitacoes.</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma solicitacao registrada.</p>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{TYPE_LABELS[item.type] || item.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {STATUS_LABELS[item.status] || item.status} | {new Date(item.submittedAt).toLocaleString('pt-BR')}
                  </p>
                  {item.publicResponse ? <p className="mt-1 text-xs text-muted-foreground">{item.publicResponse}</p> : null}
                </div>
                {item.type === 'export' && !['canceled', 'rejected'].includes(item.status) ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => generateExport.mutate(item.id)} disabled={generateExport.isPending}>
                    {generateExport.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Gerar JSON
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
