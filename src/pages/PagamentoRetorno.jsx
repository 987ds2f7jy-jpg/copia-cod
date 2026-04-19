import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createPageUrl } from '@/utils';

const STATUS_CONFIG = {
  sucesso: {
    icon: CheckCircle,
    title: 'Pagamento recebido pelo provedor',
    description: 'A liberacao final acontece pelo webhook seguro do backend. Se a tela ainda nao atualizou, aguarde alguns instantes.',
    className: 'text-emerald-600 bg-emerald-100',
  },
  falha: {
    icon: AlertTriangle,
    title: 'Pagamento nao concluido',
    description: 'O provedor nao confirmou o pagamento. Volte ao fluxo e tente novamente.',
    className: 'text-red-600 bg-red-100',
  },
  pendente: {
    icon: Clock,
    title: 'Pagamento pendente',
    description: 'O pagamento ainda esta em processamento. O backend liberara o atendimento apenas apos confirmacao formal.',
    className: 'text-amber-600 bg-amber-100',
  },
};

function PagamentoRetornoInner() {
  const navigate = useNavigate();
  const { status = 'pendente' } = useParams();
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pendente;
  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-lg px-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <div className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full ${config.className}`}>
              <Icon className="h-8 w-8" />
            </div>
            <h1 className="mb-3 text-2xl font-bold text-gray-900">{config.title}</h1>
            <p className="mb-6 text-sm leading-6 text-gray-600">{config.description}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button variant="outline" onClick={() => navigate(createPageUrl('DashboardPaciente'))}>
                Ver painel
              </Button>
              <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => navigate(createPageUrl('Home'))}>
                Voltar ao inicio
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PagamentoRetorno() {
  return (
    <ProtectedRoute>
      <PagamentoRetornoInner />
    </ProtectedRoute>
  );
}
