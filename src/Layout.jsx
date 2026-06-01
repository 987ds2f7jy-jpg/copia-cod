import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Menu, X, User, Calendar, LogOut, Stethoscope, 
  Home, Search, Clock, MessageSquare, Settings,
  ArrowLeft, Shield, Video, Sparkles, FileText, CreditCard
} from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { useAuth } from '@/components/AuthContext';
import { useMyActiveConsultation } from '@/hooks/useMyActiveConsultation';

function BrandMark({ className = 'h-8 w-8' }) {
  return (
    <span className={`${className} inline-flex overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5 dark:ring-white/10`}>
      <img
        src="/rapido-doutor-logo.png"
        alt="Rápido Doutor"
        className="h-full w-full object-cover"
      />
    </span>
  );
}

// Pages that are "root" pages (show logo) vs "child" pages (show back button on mobile)
const ROOT_PAGES = ['Home', 'Especialidades', 'AgendamentoEspecialidade', 'ConsultaAgora', 'PergunteEspecialista', 'Planos'];

// Bottom nav items for mobile
const BOTTOM_NAV = [
  { name: 'Início', page: 'Home', icon: Home },
  { name: 'Agendar', page: 'AgendamentoEspecialidade', icon: Search },
  { name: 'Consultas', page: 'DashboardPaciente', icon: Calendar },
  { name: 'Perfil', page: 'Perfil', icon: User },
];

function ActiveConsultationBanner({ activeConsultation, onResume }) {
  const consultationStatus = String(activeConsultation?.consultation?.status || '').trim();
  const consultationType = String(activeConsultation?.consultation?.consultationType || '').trim();
  const counterpartName = activeConsultation?.counterpartName || 'o outro participante';
  const counterpartLabel = activeConsultation?.participantRole === 'professional'
    ? counterpartName
    : `Dr(a). ${counterpartName}`;
  const title = consultationStatus === 'em_atendimento'
    ? 'Voce tem uma consulta em andamento.'
    : 'Voce tem uma consulta aguardando retorno.';

  let description = `A consulta com ${counterpartLabel} continua disponivel para retomada.`;

  if (consultationStatus === 'aguardando' && consultationType === 'plantao') {
    description = `O atendimento imediato com ${counterpartLabel} ainda esta reservado para voce.`;
  } else if (activeConsultation?.needsProfessionalStart) {
    description = `A consulta com ${counterpartLabel} ainda aguarda a abertura da sala segura pelo profissional.`;
  } else if (activeConsultation?.roomReady) {
    description = `A sala segura com ${counterpartLabel} ja esta pronta para reconexao.`;
  }

  return (
    <div className="border-b border-emerald-100 bg-emerald-50/90 dark:border-emerald-900/50 dark:bg-emerald-950/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">{title}</p>
          <p className="text-sm text-emerald-700 dark:text-emerald-300">{description}</p>
        </div>

        <Button
          size="sm"
          className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={onResume}
        >
          <Video className="h-4 w-4" />
          Retomar consulta
        </Button>
      </div>
    </div>
  );
}

function LayoutInner({ children, currentPageName }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const isRootPage = ROOT_PAGES.includes(currentPageName);

  const { data: activeConsultation } = useMyActiveConsultation();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    logout(); // AuthContext.logout: limpa estado, cache, storage e navega para "/"
  };

  const navLinks = [
    { name: 'Início', page: 'Home', icon: Home },
    { name: 'Agendamento', page: 'AgendamentoEspecialidade', icon: Search },
    { name: 'Consulta Agora', page: 'ConsultaAgora', icon: Clock },
    { name: 'Pergunte ao Especialista', page: 'PergunteEspecialista', icon: MessageSquare },
    { name: 'Planos', page: 'Planos', icon: Sparkles },
  ];

  const hideLayoutPages = ['Login', 'Cadastro', 'Entrar', 'RecuperarSenha', 'Teleconsulta'];
  if (hideLayoutPages.includes(currentPageName)) {
    return <>{children}</>;
  }

  const storedActiveConsultationId = typeof window !== 'undefined'
    ? window.sessionStorage.getItem('rd_last_active_consultation')
    : null;
  const activeConsultationPath = activeConsultation?.resumeUrl ||
    (activeConsultation?.consultation?.id ? `/consulta/${activeConsultation.consultation.id}` : null);
  const activeConsultationStatus = String(activeConsultation?.consultation?.status || '').trim();
  const activeConsultationType = String(activeConsultation?.consultation?.consultationType || '').trim();
  const canResumeConsultation = Boolean(
    activeConsultationPath &&
    !location.pathname.startsWith('/consulta/') &&
    (
      activeConsultationStatus === 'em_atendimento' ||
      activeConsultationStatus === 'in_progress' ||
      activeConsultation?.roomReady ||
      (activeConsultationStatus === 'aguardando' && activeConsultationType === 'plantao') ||
      storedActiveConsultationId === activeConsultation?.consultation?.id
    )
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 safe-area-top ${
          isScrolled ? 'border-b border-border bg-background/95 shadow-sm backdrop-blur-md' : 'bg-background'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 lg:h-20">

            {/* Mobile: Back button on child pages, Logo on root pages */}
            <div className="flex items-center gap-2">
              {!isRootPage ? (
                <>
                  <button
                    className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-accent active:bg-accent/80"
                    onClick={() => navigate(-1)}
                    aria-label="Voltar"
                  >
                    <ArrowLeft className="w-5 h-5 text-foreground" />
                  </button>
                  <Link to={createPageUrl('Home')} className="hidden lg:flex items-center gap-2">
                    <BrandMark className="h-9 w-9" />
                    <span className="text-xl font-bold text-foreground">Rápido Doutor</span>
                  </Link>
                  <span className="lg:hidden text-base font-semibold text-foreground">
                    {currentPageName === 'DashboardPaciente' ? 'Minhas Consultas'
                      : currentPageName === 'DashboardProfissional' ? 'Área Profissional'
                      : currentPageName === 'PerfilProfissional' ? 'Perfil do Médico'
                      : currentPageName === 'Agendamento' ? 'Agendar Consulta'
                      : currentPageName === 'AgendamentoPerfil' ? 'Agendar com Profissional'
                      : currentPageName === 'AgendamentoEspecialidade' ? 'Agendamento'
                      : currentPageName === 'CadastroProfissional' ? 'Cadastro Profissional'
                      : currentPageName === 'CadastroPaciente' ? 'Criar Conta'
                      : currentPageName === 'Perfil' ? 'Meu Perfil'
                      : currentPageName === 'MeusPlanos' ? 'Meus Planos'
                      : 'Voltar'}
                  </span>
                </>
              ) : (
                <Link to={createPageUrl('Home')} className="flex items-center gap-2">
                  <BrandMark className="h-8 w-8 lg:h-9 lg:w-9" />
                  <span className="text-lg lg:text-xl font-bold text-foreground">Rápido Doutor</span>
                </Link>
              )}
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.page}
                  to={createPageUrl(link.page)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPageName === link.page
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </nav>

            {/* User Actions */}
            <div className="flex items-center gap-2">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center gap-2 px-2"
                      aria-label="Menu do usuário"
                    >
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <User className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
                      </div>
                      <span className="hidden sm:inline text-sm font-medium">
                        {user.full_name?.split(' ')[0] || 'Usuário'}
                      </span>
                
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 border-border bg-popover text-popover-foreground">
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                      {user.role === 'professional' && (
                        <span className="inline-block mt-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full dark:bg-emerald-500/10 dark:text-emerald-300">Profissional</span>
                      )}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl('DashboardPaciente')} className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Minhas Consultas
                      </Link>
                    </DropdownMenuItem>
                    {user.role === 'patient' && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to={createPageUrl('MeuProntuario')} className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Meu Prontuário
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={createPageUrl('MeusPlanos')} className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            Meus Planos
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={createPageUrl('MeusPagamentos')} className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            Meus Pagamentos
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    {user.role === 'professional' && (
                      <DropdownMenuItem asChild>
                        <Link to={createPageUrl('DashboardProfissional')} className="flex items-center gap-2">
                          <Stethoscope className="w-4 h-4" />
                          Área Profissional
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {user.role === 'admin' && (
                      <DropdownMenuItem asChild>
                        <Link to={createPageUrl('AdminAprovacao')} className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-emerald-600" />
                          Aprovar Profissionais
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl('Perfil')} className="flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Configurações
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-2">
                  <Link to={createPageUrl('Entrar')}>
                    <Button variant="ghost" className="flex items-center gap-2 px-3 h-9 border border-border">
                      <User className="w-4 h-4" />
                      <span className="text-sm font-medium">Entrar</span>
                    </Button>
                  </Link>
                  <Link to={createPageUrl('CadastroPaciente')} className="hidden sm:block">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-9">
                      Criar conta
                    </Button>
                  </Link>
                </div>
              )}

              {/* Mobile hamburger — only on root pages */}
              {isRootPage && (
                <button
                  className="lg:hidden p-2 rounded-lg hover:bg-accent"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                  {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Slide-down Menu */}
        {isMenuOpen && (
          <div className="lg:hidden border-t border-border bg-background">
            <div className="px-4 py-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.page}
                  to={createPageUrl(link.page)}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    currentPageName === link.page
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <link.icon className="w-5 h-5" />
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="pt-14 lg:pt-20 pb-20 lg:pb-0">
        {canResumeConsultation && (
          <ActiveConsultationBanner
            activeConsultation={activeConsultation}
            onResume={() => navigate(activeConsultationPath)}
          />
        )}
        <PageTransition>{children}</PageTransition>
      </main>

      {/* Desktop Footer */}
      <footer className="hidden lg:block bg-gray-900 text-white mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <BrandMark className="h-9 w-9" />
                <span className="text-xl font-bold">Rápido Doutor</span>
              </div>
              <p className="text-gray-400 text-sm">
                Conectando você aos melhores profissionais de saúde, quando você precisa.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Serviços</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link to={createPageUrl('Especialidades')} className="hover:text-white">Ver Especialistas</Link></li>
                <li><Link to={createPageUrl('AgendamentoEspecialidade')} className="hover:text-white">Agendamento</Link></li>
                <li><Link to={createPageUrl('ConsultaAgora')} className="hover:text-white">Consulta Agora</Link></li>
                <li><Link to={createPageUrl('PergunteEspecialista')} className="hover:text-white">Pergunte ao Especialista</Link></li>
                <li><Link to={createPageUrl('Planos')} className="hover:text-white">Planos</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Para Profissionais</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link to={createPageUrl('CadastroProfissional')} className="hover:text-white">Cadastre-se</Link></li>
                <li><Link to={createPageUrl('DashboardProfissional')} className="hover:text-white">Área do Médico</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Suporte</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Central de Ajuda</a></li>
                <li><a href="#" className="hover:text-white">Termos de Uso</a></li>
                <li><a href="#" className="hover:text-white">Privacidade</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500">
            © 2026 Rápido Doutor. Todos os direitos reservados.
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background safe-area-bottom">
        <div className="flex">
          {BOTTOM_NAV.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 transition-colors ${
                  isActive ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'
                }`}
              >
                <item.icon className={`w-6 h-6 ${isActive ? 'stroke-2' : 'stroke-[1.5]'}`} />
                <span className="text-[10px] font-medium leading-none">{item.name}</span>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-emerald-600 rounded-full" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  return <LayoutInner currentPageName={currentPageName}>{children}</LayoutInner>;
}
