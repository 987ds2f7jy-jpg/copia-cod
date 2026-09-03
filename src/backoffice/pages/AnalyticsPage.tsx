import { useQuery } from '@tanstack/react-query';
import { Activity, Stethoscope, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getBackofficeAnalyticsSummary } from '../api/analytics';

const formatter = new Intl.NumberFormat('pt-BR');

export function AnalyticsPage() {
  const query = useQuery({ queryKey: ['backoffice', 'analytics-summary'], queryFn: getBackofficeAnalyticsSummary });
  const cards = [
    { title: 'Médicos cadastrados', value: query.data?.totalProfessionals, icon: Stethoscope },
    { title: 'Usuários cadastrados', value: query.data?.totalUsers, icon: Users },
    { title: 'Consultas realizadas', value: query.data?.totalCompletedConsultations, icon: Activity },
  ];

  return (
    <section className="space-y-6">
      <div><h2 className="text-2xl font-bold text-foreground">Análise de dados</h2><p className="mt-1 text-muted-foreground">Indicadores gerais da plataforma.</p></div>
      {query.isError && <p className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{query.error instanceof Error ? query.error.message : 'Não foi possível carregar os indicadores.'}</p>}
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(({ title, value, icon: Icon }) => <Card key={title}><CardHeader className="flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-3xl font-bold">{query.isLoading ? '—' : formatter.format(value || 0)}</div><CardDescription className="mt-1">Total acumulado</CardDescription></CardContent></Card>)}
      </div>
    </section>
  );
}
