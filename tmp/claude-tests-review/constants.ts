/**
 * support/constants.ts
 *
 * PROPÓSITO
 *   Fonte única de verdade para rotas, seletores semânticos e dados de
 *   usuários de teste. Nenhum spec deve conter strings de URL ou seletores
 *   inline — tudo passa por aqui.
 *
 * POR QUE EXISTE
 *   O projeto é modificado frequentemente via IA. Centralizar seletores
 *   e rotas significa que uma renomeação de rota ou de label exige
 *   alteração em um único lugar, não em dezenas de spec files.
 *
 * CONVENÇÃO DE SELETORES
 *   Prioridade (do mais ao menos estável):
 *     1. getByRole() + name   — mais resiliente a CSS/estrutura
 *     2. getByLabel()         — formulários
 *     3. getByText()          — mensagens e headings
 *     4. data-testid          — fallback quando não há semântica acessível
 *   Nunca usar: classes CSS, IDs gerados por libs, índices de array.
 *
 * NOTA SOBRE CREDENCIAIS
 *   Os valores abaixo são placeholders. Em CI, sobrescreva via variáveis
 *   de ambiente. Nunca commite senhas reais aqui.
 */

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------
export const ROUTES = {
  home:                    '/',
  entrar:                  '/Entrar',
  cadastroPaciente:        '/CadastroPaciente',
  cadastroProfissional:    '/CadastroProfissional',
  especialidades:          '/Especialidades',
  agendamentoEspecialidade: '/AgendamentoEspecialidade',
  agendamentoPerfil:       '/AgendamentoPerfil',
  agendamentoAlias:        '/Agendamento',
  consultaAgora:           '/ConsultaAgora',
  dashboardPaciente:       '/DashboardPaciente',
  dashboardProfissional:   '/DashboardProfissional',
  perfil:                  '/Perfil',
  perfilProfissional:      '/PerfilProfissional',
  laudosMedicos:           '/LaudosMedicos',
  solicitacaoExames:       '/SolicitacaoExames',
  renovacaoReceitas:       '/RenovacaoReceitas',
  pergunteEspecialista:    '/PergunteEspecialista',
  teleconsulta:            '/Teleconsulta',
  consultaRoom:            (id: string) => `/consulta/${id}`,
  financeiroProf:          '/FinanceiroProfissional',
  adminAprovacao:          '/AdminAprovacao',
  planos:                  '/Planos',
  pagamentoRetorno:        (status: string) => `/pagamento/${status}`,
  notFound:                '/rota-que-nao-existe',
} as const;

// ---------------------------------------------------------------------------
// Rotas públicas (sem login)
// ---------------------------------------------------------------------------
export const PUBLIC_ROUTES = [
  ROUTES.home,
  ROUTES.entrar,
  ROUTES.cadastroPaciente,
  ROUTES.cadastroProfissional,
  ROUTES.especialidades,
  ROUTES.perfilProfissional,
] as const;

// ---------------------------------------------------------------------------
// Rotas que exigem autenticação (qualquer role)
// ---------------------------------------------------------------------------
export const AUTH_REQUIRED_ROUTES = [
  ROUTES.dashboardPaciente,
  ROUTES.consultaAgora,
  ROUTES.perfil,
  ROUTES.laudosMedicos,
  ROUTES.solicitacaoExames,
] as const;

// ---------------------------------------------------------------------------
// Rotas que exigem role específica
// ---------------------------------------------------------------------------
export const ROLE_ROUTES = {
  professional: [ROUTES.dashboardProfissional, ROUTES.financeiroProf],
  admin: [ROUTES.adminAprovacao],
} as const;

// ---------------------------------------------------------------------------
// Seletores semânticos (via Playwright locators)
// Comentário explica onde o elemento aparece e por que esse seletor foi escolhido
// ---------------------------------------------------------------------------
export const SELECTORS = {
  // --- Auth ---
  emailInput:         { role: 'textbox' as const, name: 'Email' },
  senhaInput:         { label: 'Senha' },
  btnEntrar:          { role: 'button' as const, name: 'Entrar' },
  btnCriarConta:      { role: 'button' as const, name: 'Criar conta' },
  btnSair:            { role: 'menuitem' as const, name: 'Sair' },
  erroLogin:          { testId: 'login-error' },          // TODO: adicionar data-testid na UI

  // --- Layout / Nav ---
  userMenuTrigger:    { role: 'button' as const, name: /usuário|médico|paciente/i },
  areaProf:           { role: 'menuitem' as const, name: 'Área Profissional' },
  minhasConsultas:    { role: 'menuitem' as const, name: 'Minhas Consultas' },

  // --- Proteção de rota ---
  // Mensagem exibida pelo ProtectedRoute quando role está errado
  acessoRestrito:     { heading: 'Acesso Restrito' },

  // --- ProfessionalStatusGate ---
  cadastroEmAnalise:  { heading: 'Cadastro em análise' },

  // --- Agendamento ---
  btnConfirmar:       { role: 'button' as const, name: /confirmar|agendar/i },
  btnProximo:         { role: 'button' as const, name: /próximo|continuar/i },
  stepSucesso:        { text: /consulta.*agendada|solicitação.*enviada/i },
  erroSlotOcupado:    { text: /horário.*ocupado|escolha.*outro/i },
  erroJanela36h:      { text: /36 horas/i },

  // --- Dashboard Paciente ---
  tabAtivas:          { role: 'tab' as const, name: /ativas|próximas/i },
  tabHistorico:       { role: 'tab' as const, name: /histórico|passadas/i },
  tabCanceladas:      { role: 'tab' as const, name: /canceladas/i },
  btnCancelarConsulta:{ role: 'button' as const, name: /cancelar/i },

  // --- Teleconsulta ---
  btnIniciarSala:     { role: 'button' as const, name: /iniciar.*sala|abrir.*sala/i },
  btnEncerrar:        { role: 'button' as const, name: /encerrar|finalizar/i },

  // --- Avaliação ---
  modalAvaliacao:     { role: 'dialog' as const, name: /avaliação/i },
  btnEnviarAvaliacao: { role: 'button' as const, name: /enviar avaliação/i },
} as const;

// ---------------------------------------------------------------------------
// Status conhecidos (mistura PT/EN — ponto crítico identificado)
// R4: statuses inconsistentes entre backend e frontend
// ---------------------------------------------------------------------------
export const APPOINTMENT_STATUS = {
  // Português (legado / alguns endpoints)
  SOLICITADO:  'SOLICITADO',
  CONFIRMADO:  'CONFIRMADO',
  CANCELADO:   'CANCELADO',
  CONCLUIDO:   'CONCLUIDO',
  EXPIRADO:    'EXPIRADO',
  // Inglês (outros endpoints)
  pending:     'pending',
  confirmed:   'confirmed',
  cancelled:   'cancelled',
  completed:   'completed',
  in_progress: 'in_progress',
  em_atendimento: 'em_atendimento',
  aguardando:  'aguardando',
  finalizada:  'finalizada',
  cancelada:   'cancelada',
} as const;

// ---------------------------------------------------------------------------
// Dados de usuários de teste (sobrescrevidos por variáveis de ambiente)
// ---------------------------------------------------------------------------
export const USERS = {
  patient: {
    email:    process.env.E2E_PATIENT_EMAIL    ?? 'paciente-e2e@rapidodoutor.test',
    password: process.env.E2E_PATIENT_PASSWORD ?? 'senha-e2e-paciente',
    name:     'Paciente E2E',
    role:     'patient' as const,
  },
  professional: {
    email:    process.env.E2E_PROFESSIONAL_EMAIL    ?? 'profissional-e2e@rapidodoutor.test',
    password: process.env.E2E_PROFESSIONAL_PASSWORD ?? 'senha-e2e-profissional',
    name:     'Dr. Profissional E2E',
    role:     'professional' as const,
  },
  admin: {
    email:    process.env.E2E_ADMIN_EMAIL    ?? 'admin-e2e@rapidodoutor.test',
    password: process.env.E2E_ADMIN_PASSWORD ?? 'senha-e2e-admin',
    name:     'Admin E2E',
    role:     'admin' as const,
  },
} as const;

// ---------------------------------------------------------------------------
// Constantes de negócio
// ---------------------------------------------------------------------------
export const SCHEDULING = {
  // lib/scheduling.js — janela padrão
  minHoursAhead:  36,
  maxDaysAhead:   14,
  // AgendamentoPerfil — janela prioritária
  priorityMinHoursAhead: 1,
  priorityMaxHoursAhead: 36,
  // Slots de 20 em 20 minutos, 08h–17:40
  slotIntervalMin: 20,
  dayStart: 8,
  dayEnd:   18,
} as const;

export const SPECIALTIES_PLANTAO = [
  'clinico_geral',
  'pediatria',
  'psicologia',
  'psiquiatria',
] as const;
