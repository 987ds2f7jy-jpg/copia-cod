import React from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { createPageUrl } from '@/utils';
import { logApiError, serializeError } from '@/lib/observability';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, info) {
    logApiError({
      scope: 'ui.error-boundary',
      error: serializeError(error),
      componentStack: info?.componentStack || null,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = createPageUrl('Home');
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border bg-card p-6 shadow-sm text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Algo saiu do esperado</h1>
          <p className="text-sm text-muted-foreground mb-6">
            O aplicativo encontrou um erro inesperado. Os logs foram registrados para facilitar a investigacao.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={this.handleReload} className="bg-slate-900 hover:bg-slate-800 text-white">
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar novamente
            </Button>
            <Button variant="outline" onClick={this.handleGoHome}>
              <Home className="w-4 h-4 mr-2" />
              Ir para a Home
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
