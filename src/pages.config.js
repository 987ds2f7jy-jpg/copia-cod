import AdminAprovacao from './pages/AdminAprovacao';
import AgendamentoPerfil from './pages/AgendamentoPerfil';
import AgendamentoEspecialidade from './pages/AgendamentoEspecialidade';
import CadastroPaciente from './pages/CadastroPaciente';
import CadastroProfissional from './pages/CadastroProfissional';
import ConsultaAgora from './pages/ConsultaAgora';
import DashboardPaciente from './pages/DashboardPaciente';
import DashboardProfissional from './pages/DashboardProfissional';
import Entrar from './pages/Entrar';
import Especialidades from './pages/Especialidades';
import Home from './pages/Home';
import Perfil from './pages/Perfil';
import PerfilProfissional from './pages/PerfilProfissional';
import PergunteEspecialista from './pages/PergunteEspecialista';
import Teleconsulta from './pages/Teleconsulta';
import __Layout from './Layout.jsx';

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
