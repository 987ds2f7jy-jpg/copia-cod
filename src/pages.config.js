import { lazy } from 'react';

const AdminAprovacao = lazy(() => import('./pages/AdminAprovacao'));
const AgendamentoPerfil = lazy(() => import('./pages/AgendamentoPerfil'));
const AgendamentoEspecialidade = lazy(() => import('./pages/AgendamentoEspecialidade'));
const AtenderServicoExtra = lazy(() => import('./pages/AtenderServicoExtra'));
const CadastroPaciente = lazy(() => import('./pages/CadastroPaciente'));
const CadastroProfissional = lazy(() => import('./pages/CadastroProfissional'));
const ConsultaAgora = lazy(() => import('./pages/ConsultaAgora'));
const DashboardPaciente = lazy(() => import('./pages/DashboardPaciente'));
const DashboardProfissional = lazy(() => import('./pages/DashboardProfissional'));
const Entrar = lazy(() => import('./pages/Entrar'));
const Especialidades = lazy(() => import('./pages/Especialidades'));
const Home = lazy(() => import('./pages/Home'));
const LaudosMedicos = lazy(() => import('./pages/LaudosMedicos'));
const MeusPagamentos = lazy(() => import('./pages/MeusPagamentos'));
const MeusPlanos = lazy(() => import('./pages/MeusPlanos'));
const MeuProntuario = lazy(() => import('./pages/MeuProntuario'));
const Perfil = lazy(() => import('./pages/Perfil'));
const PerfilProfissional = lazy(() => import('./pages/PerfilProfissional'));
const PergunteEspecialista = lazy(() => import('./pages/PergunteEspecialista'));
const Planos = lazy(() => import('./pages/Planos'));
const RecuperarSenha = lazy(() => import('./pages/RecuperarSenha'));
const SolicitacaoExames = lazy(() => import('./pages/SolicitacaoExames'));
const RenovacaoReceitas = lazy(() => import('./pages/RenovacaoReceitas'));
const Teleconsulta = lazy(() => import('./pages/Teleconsulta'));
const __Layout = lazy(() => import('./Layout.jsx'));

export const PAGES = {
    "AdminAprovacao": AdminAprovacao,
    "AgendamentoPerfil": AgendamentoPerfil,
    "AgendamentoEspecialidade": AgendamentoEspecialidade,
    "AtenderServicoExtra": AtenderServicoExtra,
    "CadastroPaciente": CadastroPaciente,
    "CadastroProfissional": CadastroProfissional,
    "ConsultaAgora": ConsultaAgora,
    "DashboardPaciente": DashboardPaciente,
    "DashboardProfissional": DashboardProfissional,
    "Entrar": Entrar,
    "Especialidades": Especialidades,
    "Home": Home,
    "LaudosMedicos": LaudosMedicos,
    "MeusPagamentos": MeusPagamentos,
    "MeusPlanos": MeusPlanos,
    "MeuProntuario": MeuProntuario,
    "Perfil": Perfil,
    "PerfilProfissional": PerfilProfissional,
    "PergunteEspecialista": PergunteEspecialista,
    "Planos": Planos,
    "RecuperarSenha": RecuperarSenha,
    "SolicitacaoExames": SolicitacaoExames,
    "RenovacaoReceitas": RenovacaoReceitas,
    "Teleconsulta": Teleconsulta,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};
