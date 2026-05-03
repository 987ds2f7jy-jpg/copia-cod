import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  FileText, Calendar, Clock, Stethoscope, User, ExternalLink, FileCheck, Inbox,
} from 'lucide-react';

// ============================================================
// MOCK DATA — TODO: substituir por chamada real ao backend
// `plano` aqui e apenas o alias visual futuro de prontuarios.recomendacoes.
// ============================================================
const PRONTUARIOS_MOCK = [
  {
    id: '1',
    data: '2026-04-29',
    hora: '08:40',
    tipo: 'Consulta por especialidade',
    categoria: 'consulta',
    status: 'finalizado',
    profissional: 'Dr. João Silva',
    especialidade: 'Clínico Geral',
    plano: 'Orientações gerais. Manter hidratação adequada (2L/dia). Realizar caminhada leve 30 minutos por dia. Seguir receita médica disponível no link abaixo. Retorno em 30 dias.',
    documentos: [
      { label: 'Abrir receita', url: 'https://exemplo.com/receita' },
    ],
  },
  {
    id: '2',
    data: '2026-04-22',
    hora: '21:15',
    tipo: 'Plantão / Consulta Agora',
    categoria: 'consulta',
    status: 'finalizado',
    profissional: 'Dra. Ana Costa',
    especialidade: 'Clínico Geral',
    plano: 'Quadro de virose viral autolimitada. Repouso por 48h. Hidratação reforçada. Paracetamol 750mg de 6/6h se febre ou dor. Retornar se sintomas persistirem por mais de 5 dias.',
    documentos: [],
  },
  {
    id: '3',
    data: '2026-04-15',
    hora: '14:00',
    tipo: 'Renovação de receita',
    categoria: 'extra',
    status: 'documento_disponivel',
    profissional: 'Dr. Pedro Almeida',
    especialidade: 'Clínico Geral',
    plano: 'Renovação aprovada para uso contínuo. Manter posologia atual. Reavaliar em consulta presencial em 6 meses.',
    documentos: [
      { label: 'Abrir documento', url: 'https://exemplo.com/receita-renovada' },
    ],
  },
  {
    id: '4',
    data: '2026-04-10',
    hora: '10:30',
    tipo: 'Check-up',
    categoria: 'extra',
    status: 'aguardando',
    profissional: 'Dra. Mariana Rocha',
    especialidade: 'Clínico Geral',
    plano: null,
    documentos: [],
  },
  {
    id: '5',
    data: '2026-04-02',
    hora: '16:20',
    tipo: 'Laudo médico',
    categoria: 'extra',
    status: 'documento_disponivel',
    profissional: 'Dr. Carlos Mendes',
    especialidade: 'Neurologia',
    plano: 'Laudo emitido conforme exames apresentados. Documento disponível para download abaixo.',
    documentos: [
      { label: 'Abrir laudo', url: 'https://exemplo.com/laudo' },
    ],
  },
];

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'consulta', label: 'Consultas' },
  { id: 'extra', label: 'Serviços extras' },
  { id: 'finalizado', label: 'Finalizados' },
  { id: 'aguardando', label: 'Pendentes' },
];

function formatarData(iso) {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function isSafeHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function LinkifiedText({ text }) {
  const value = String(text || '');
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const parts = value.split(urlRegex);

  return parts.map((part, index) => {
    if (!/^https?:\/\//i.test(part)) {
      return <React.Fragment key={index}>{part}</React.Fragment>;
    }

    const cleanUrl = part.replace(/[),.;!?]+$/, '');
    const trailing = part.slice(cleanUrl.length);

    if (!isSafeHttpUrl(cleanUrl)) {
      return <React.Fragment key={index}>{part}</React.Fragment>;
    }

    return (
      <React.Fragment key={index}>
        <a
          href={cleanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
        >
          {cleanUrl}
        </a>
        {trailing}
      </React.Fragment>
    );
  });
}

function StatusBadge({ status }) {
  const map = {
    finalizado: { label: 'Finalizado', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
    em_andamento: { label: 'Em andamento', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' },
    aguardando: { label: 'Aguardando plano', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
    documento_disponivel: { label: 'Documento disponível', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  };
  const v = map[status] || { label: status, cls: 'bg-muted text-muted-foreground' };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${v.cls}`}>{v.label}</span>;
}

function ProntuarioCard({ item, onOpen }) {
  const temPlano = Boolean(item.plano);
  return (
    <Card className="border-border hover:shadow-md transition-shadow">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={item.status} />
              <Badge variant="outline" className="text-xs">{item.tipo}</Badge>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span className="font-medium text-foreground">{formatarData(item.data)}</span>
                <Clock className="w-4 h-4 ml-2" />
                <span>{item.hora}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-emerald-600" />
                <span className="font-medium text-foreground">{item.profissional}</span>
              </div>
              {item.especialidade && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Stethoscope className="w-4 h-4" />
                  <span>{item.especialidade}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-2">
            <Button
              onClick={() => onOpen(item)}
              disabled={!temPlano}
              className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
            >
              <FileText className="w-4 h-4" />
              Ver prontuário
            </Button>
            {!temPlano && (
              <span className="text-xs text-muted-foreground">Plano ainda não disponível</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanoModal({ item, open, onClose }) {
  if (!item) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-emerald-600" />
            Plano da consulta
          </DialogTitle>
          <DialogDescription>
            {formatarData(item.data)} às {item.hora} • {item.profissional}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{item.tipo}</Badge>
            {item.especialidade && <Badge variant="outline">{item.especialidade}</Badge>}
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <h4 className="text-sm font-semibold text-foreground mb-2">Plano terapêutico</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
              <LinkifiedText text={item.plano} />
            </p>
          </div>

          {item.documentos?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Documentos</h4>
              {item.documentos.map((doc, i) => (
                <a
                  key={i}
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border bg-background hover:bg-accent transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    {doc.label}
                  </span>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </a>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center text-center py-16 px-6">
        <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-4">
          <Inbox className="w-7 h-7 text-emerald-600" />
        </div>
        <h3 className="text-base font-semibold text-foreground">Nenhum prontuário disponível ainda.</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Após uma consulta finalizada, o plano aparecerá aqui.
        </p>
      </CardContent>
    </Card>
  );
}

export default function MeuProntuario() {
  const [filtro, setFiltro] = useState('todos');
  const [selected, setSelected] = useState(null);

  // TODO: substituir PRONTUARIOS_MOCK por dados reais do backend
  const items = PRONTUARIOS_MOCK;

  const filtrados = useMemo(() => {
    if (filtro === 'todos') return items;
    if (filtro === 'consulta' || filtro === 'extra') {
      return items.filter((i) => i.categoria === filtro);
    }
    return items.filter((i) => i.status === filtro);
  }, [filtro, items]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Meu Prontuário</h1>
          <p className="text-sm lg:text-base text-muted-foreground mt-2">
            Acesse os planos, recomendações e documentos das suas consultas.
          </p>
        </header>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filtro === f.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {filtrados.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {filtrados.map((item) => (
              <ProntuarioCard key={item.id} item={item} onOpen={setSelected} />
            ))}
          </div>
        )}
      </div>

      <PlanoModal item={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
