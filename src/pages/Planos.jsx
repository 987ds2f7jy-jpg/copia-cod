import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { createPlanCheckout } from '@/client-api/plans';
import { useAuth } from '@/components/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles, Users, Brain, Check, Building2, Send, Star, ShieldCheck, Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PAYMENT_RETURN_CONTEXT_KEY = 'rd.payment.return_context.v1';

// ============================================================
// Catalogo visual; preco real e plano externo sao resolvidos no backend.
// ============================================================
const PLANOS_UI = [
  {
    id: 'emagrecimento',
    planCode: 'weight_loss',
    nome: 'Emagrecimento',
    descricao:
      'Acompanhamento completo com nutricionista e endocrinologista para uma jornada de emagrecimento saudável e sustentável.',
    preco: 149.9,
    periodo: 'mês',
    icone: Sparkles,
    destaque: false,
    beneficios: [
      'Consultas mensais com nutricionista',
      'Acompanhamento com endocrinologista',
      'Plano alimentar personalizado',
      'Suporte por chat com a equipe',
    ],
    cta: 'Quero esse plano',
  },
  {
    id: 'familiar',
    planCode: 'family',
    nome: 'Familiar',
    descricao:
      'Cuidado integral para até 4 pessoas da mesma família, com acesso a clínico geral e principais especialidades.',
    preco: 249.9,
    periodo: 'mês',
    icone: Users,
    destaque: true,
    beneficios: [
      'Até 4 dependentes inclusos',
      'Consultas ilimitadas com clínico geral',
      'Pediatria e ginecologia inclusas',
      'Pronto atendimento 24h',
    ],
    cta: 'Escolher plano familiar',
  },
  {
    id: 'psicologia',
    planCode: 'psychology',
    nome: 'Psicologia',
    descricao:
      'Acompanhamento psicológico contínuo com sessões semanais e suporte emocional sempre que precisar.',
    preco: 199.9,
    periodo: 'mês',
    icone: Brain,
    destaque: false,
    beneficios: [
      '4 sessões mensais com psicólogo',
      'Profissional fixo de sua escolha',
      'Sessões de 50 minutos',
      'Reagendamento sem custo',
    ],
    cta: 'Começar agora',
  },
];

function formatPreco(valor) {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ============================================================
// Card de Plano
// ============================================================
function PlanoCard({ plano, index, loading, disabled, onCheckout }) {
  const Icone = plano.icone;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="h-full"
    >
      <Card
        className={`relative h-full border-0 transition-all duration-300 hover:-translate-y-1 ${
          plano.destaque
            ? 'shadow-lg ring-2 ring-emerald-500 bg-gradient-to-b from-white to-emerald-50/40 dark:from-card dark:to-emerald-950/30'
            : 'shadow-sm hover:shadow-md bg-card'
        }`}
      >
        {plano.destaque && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white shadow-sm flex items-center gap-1 px-3 py-1">
              <Star className="w-3 h-3 fill-white" />
              Mais escolhido
            </Badge>
          </div>
        )}

        <CardContent className="p-6 lg:p-8 flex flex-col h-full">
          {/* Cabeçalho */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                plano.destaque
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'
              }`}
            >
              <Icone className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-foreground leading-tight">
                {plano.nome}
              </h3>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Plano de fidelidade
              </p>
            </div>
          </div>

          {/* Descrição */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            {plano.descricao}
          </p>

          {/* Preço */}
          <div className="mb-6">
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-medium text-muted-foreground">R$</span>
              <span className="text-4xl font-bold text-foreground tracking-tight">
                {formatPreco(plano.preco)}
              </span>
              <span className="text-sm text-muted-foreground">/{plano.periodo}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Cobrado mensalmente · Cancele quando quiser
            </p>
          </div>

          {/* Benefícios */}
          <ul className="space-y-3 mb-8 flex-1">
            {plano.beneficios.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <Check className="w-3 h-3" strokeWidth={3} />
                </span>
                <span className="leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>

          {/* CTA visual (sem integração) */}
          <Button
            className={`w-full h-11 ${
              plano.destaque
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-700 dark:hover:bg-emerald-600'
            }`}
            type="button"
            disabled={loading || disabled}
            onClick={() => onCheckout(plano)}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Preparando checkout...' : plano.cta}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================================
// Formulário Empresas (apenas visual)
// ============================================================
const INITIAL_FORM = {
  empresa: '',
  responsavel: '',
  email: '',
  telefone: '',
  vidas: '',
  mensagem: '',
};

function FormularioEmpresas() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [enviando, setEnviando] = useState(false);
  const { toast } = useToast();

  const handleChange = (campo) => (e) =>
    setForm((prev) => ({ ...prev, [campo]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    // Apenas visual — sem envio real / sem integração
    setEnviando(true);
    setTimeout(() => {
      setEnviando(false);
      setForm(INITIAL_FORM);
      toast({
        title: 'Solicitação registrada',
        description:
          'Recebemos seus dados. Em breve nossa equipe comercial entrará em contato.',
      });
    }, 600);
  };

  return (
    <Card className="border border-border shadow-sm">
      <CardContent className="p-6 lg:p-8">
        <div className="flex items-start gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">
              Planos personalizados para sua empresa
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Conte um pouco sobre sua empresa e nossa equipe comercial irá
              preparar uma proposta sob medida.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="empresa">Nome da empresa</Label>
            <Input
              id="empresa"
              required
              placeholder="Ex: Acme Saúde Ltda."
              value={form.empresa}
              onChange={handleChange('empresa')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsavel">Nome do responsável</Label>
            <Input
              id="responsavel"
              required
              placeholder="Seu nome completo"
              value={form.responsavel}
              onChange={handleChange('responsavel')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail corporativo</Label>
            <Input
              id="email"
              type="email"
              required
              placeholder="responsavel@empresa.com"
              value={form.email}
              onChange={handleChange('email')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              required
              placeholder="(11) 99999-0000"
              value={form.telefone}
              onChange={handleChange('telefone')}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="vidas">Quantidade estimada de vidas / colaboradores</Label>
            <Input
              id="vidas"
              type="number"
              min={1}
              required
              placeholder="Ex: 150"
              value={form.vidas}
              onChange={handleChange('vidas')}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="mensagem">Mensagem / necessidade</Label>
            <Textarea
              id="mensagem"
              rows={4}
              placeholder="Descreva brevemente o que sua empresa precisa..."
              value={form.mensagem}
              onChange={handleChange('mensagem')}
            />
          </div>

          <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Seus dados são tratados com segurança e confidencialidade.
            </div>
            <Button
              type="submit"
              disabled={enviando}
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 px-6 w-full sm:w-auto"
            >
              <Send className="w-4 h-4" />
              {enviando ? 'Enviando...' : 'Solicitar proposta'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Página
// ============================================================
export default function Planos() {
  const { isAuthenticated, loading: authLoading, redirectToLogin, user } = useAuth();
  const [loadingPlanCode, setLoadingPlanCode] = useState('');
  const { toast } = useToast();

  function storePaymentReturnContext(checkout) {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.setItem(PAYMENT_RETURN_CONTEXT_KEY, JSON.stringify({
      ownerType: 'plan_subscription',
      ownerId: checkout.order?.id || '',
      paymentChargeId: checkout.payment?.paymentChargeId || checkout.order?.currentPaymentChargeId || null,
      providerChargeId: checkout.payment?.providerChargeId || null,
      successRedirectPath: '/Planos?pagamento=sucesso',
      failureRedirectPath: '/Planos?pagamento=falha',
      pendingRedirectPath: '/Planos?pagamento=pendente',
      returnPath: '/Planos',
      createdAt: new Date().toISOString(),
    }));
  }

  async function handleCheckout(plano) {
    if (authLoading) {
      return;
    }

    if (!isAuthenticated) {
      redirectToLogin('/Planos');
      return;
    }

    if (user?.role && user.role !== 'patient') {
      toast({
        title: 'Acesso restrito',
        description: 'A contratacao de planos esta disponivel para pacientes.',
        variant: 'destructive',
      });
      return;
    }

    setLoadingPlanCode(plano.planCode);

    try {
      const checkout = await createPlanCheckout(plano.planCode);

      if (!checkout?.checkoutUrl) {
        toast({
          title: 'Checkout criado',
          description: 'A cobranca foi criada, mas o provedor atual nao retornou uma URL de checkout.',
        });
        return;
      }

      storePaymentReturnContext(checkout);
      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      if (error?.status === 401 || error?.code === 'AUTH_SESSION_REQUIRED') {
        redirectToLogin('/Planos');
        return;
      }

      toast({
        title: 'Erro ao iniciar pagamento',
        description: error instanceof Error ? error.message : 'Nao foi possivel criar o checkout do plano.',
        variant: 'destructive',
      });
    } finally {
      setLoadingPlanCode('');
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-gradient-to-b from-white to-gray-50 border-b border-border dark:from-card dark:to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl"
          >
            <Badge variant="outline" className="mb-4 border-emerald-200 text-emerald-700 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
              Programa de fidelidade
            </Badge>
            <h1 className="text-3xl lg:text-5xl font-bold text-foreground tracking-tight mb-4">
              Planos pensados para o seu cuidado contínuo
            </h1>
            <p className="text-base lg:text-lg text-muted-foreground leading-relaxed">
              Escolha o plano ideal para você, para sua família ou para sua empresa
              e tenha acesso aos melhores profissionais de saúde quando precisar.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Conteúdo */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <Tabs defaultValue="planos" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
            <TabsTrigger value="planos">Planos</TabsTrigger>
            <TabsTrigger value="empresas">Empresas</TabsTrigger>
          </TabsList>

          {/* Aba Planos */}
          <TabsContent value="planos" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 pt-4">
              {PLANOS_UI.map((plano, idx) => (
                <PlanoCard
                  key={plano.id}
                  plano={plano}
                  index={idx}
                  loading={loadingPlanCode === plano.planCode}
                  disabled={Boolean(loadingPlanCode) || authLoading}
                  onCheckout={handleCheckout}
                />
              ))}
            </div>

            <p className="text-center text-xs text-muted-foreground mt-8">
              Os valores e benefícios apresentados são ilustrativos e podem ser
              ajustados antes da contratação.
            </p>
          </TabsContent>

          {/* Aba Empresas */}
          <TabsContent value="empresas" className="mt-0">
            <div className="max-w-3xl mx-auto">
              <FormularioEmpresas />
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
