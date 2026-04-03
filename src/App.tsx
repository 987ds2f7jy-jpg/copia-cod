import { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, useSearchParams } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/components/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLoadingScreen from '@/components/AppLoadingScreen';

const Teleconsulta = lazy(() => import('./pages/Teleconsulta'));
const FinanceiroProfissional = lazy(() => import('./pages/FinanceiroProfissional'));

const { Pages, Layout, mainPage } = pagesConfig;

function AgendamentoRedirect() {
  const [searchParams] = useSearchParams();
  const qs = searchParams.toString();
  return <Navigate to={`/AgendamentoPerfil${qs ? '?' + qs : ''}`} replace />;
}

const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : () => <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const routeProtection = {
  AdminAprovacao: { requiredRole: 'admin' },
  Teleconsulta: {},
};

function withRouteProtection(pageName, element) {
  const config = routeProtection[pageName];

  if (!config) {
    return element;
  }

  return <ProtectedRoute requiredRole={config.requiredRole}>{element}</ProtectedRoute>;
}

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <AuthProvider>
        <Router>
          <NavigationTracker />
          <Suspense fallback={<AppLoadingScreen />}>
            <Routes>
              <Route path="/" element={
                <LayoutWrapper currentPageName={mainPageKey}>
                  <MainPage />
                </LayoutWrapper>
              } />
              {Object.entries(Pages).map(([path, Page]: [string, any]) => (
                <Route
                  key={path}
                  path={`/${path}`}
                  element={
                    <LayoutWrapper currentPageName={path}>
                      {withRouteProtection(path, <Page />)}
                    </LayoutWrapper>
                  }
                />
              ))}
              <Route path="/Agendamento" element={<AgendamentoRedirect />} />
              <Route
                path="/consulta/:consultaId"
                element={
                  <LayoutWrapper currentPageName="Teleconsulta">
                    <ProtectedRoute>
                      <Teleconsulta />
                    </ProtectedRoute>
                  </LayoutWrapper>
                }
              />
              <Route
                path="/FinanceiroProfissional"
                element={
                  <LayoutWrapper currentPageName="FinanceiroProfissional">
                    <ProtectedRoute requiredRole="professional">
                      <FinanceiroProfissional />
                    </ProtectedRoute>
                  </LayoutWrapper>
                }
              />
              <Route path="*" element={<PageNotFound />} />
            </Routes>
          </Suspense>
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
