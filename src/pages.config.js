import { lazy } from 'react';

const AdminAprovacao = lazy(() => import('./pages/AdminAprovacao'));
const AgendamentoPerfil = lazy(() => import('./pages/AgendamentoPerfil'));
const AgendamentoEspecialidade = lazy(() => import('./pages/AgendamentoEspecialidade'));
const CadastroPaciente = lazy(() => import('./pages/CadastroPaciente'));
const CadastroProfissional = lazy(() => import('./pages/CadastroProfissional'));
const ConsultaAgora = lazy(() => import('./pages/ConsultaAgora'));
const DashboardPaciente = lazy(() => import('./pages/DashboardPaciente'));
const DashboardProfissional = lazy(() => import('./pages/DashboardProfissional'));
const Entrar = lazy(() => import('./pages/Entrar'));
const Especialidades = lazy(() => import('./pages/Especialidades'));
const Home = lazy(() => import('./pages/Home'));
const Perfil = lazy(() => import('./pages/Perfil'));
const PerfilProfissional = lazy(() => import('./pages/PerfilProfissional'));
const PergunteEspecialista = lazy(() => import('./pages/PergunteEspecialista'));
const Teleconsulta = lazy(() => import('./pages/Teleconsulta'));
const __Layout = lazy(() => import('./Layout.jsx'));

export const PAGES = {
    "AdminAprovacao": AdminAprovacao,
    "AgendamentoPerfil": AgendamentoPerfil,
    "AgendamentoEspecialidade": AgendamentoEspecialidade,
    "CadastroPaciente": CadastroPaciente,
    "CadastroProfissional": CadastroProfissional,
    "ConsultaAgora": ConsultaAgora,
    "DashboardPaciente": DashboardPaciente,
    "DashboardProfissional": DashboardProfissional,
    "Entrar": Entrar,
    "Especialidades": Especialidades,
    "Home": Home,
    "Perfil": Perfil,
    "PerfilProfissional": PerfilProfissional,
    "PergunteEspecialista": PergunteEspecialista,
    "Teleconsulta": Teleconsulta,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};
