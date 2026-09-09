import { Navigate, Route, Routes } from 'react-router-dom';
import { BackofficeAuthProvider } from './hooks/useBackofficeAuth';
import { BackofficeLayout } from './components/BackofficeLayout';
import { ProtectedBackofficeRoute } from './components/ProtectedBackofficeRoute';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { BackofficeLoginPage } from './pages/BackofficeLoginPage';
import { PendingProfessionalsPage } from './pages/PendingProfessionalsPage';

export default function BackofficeRoutes() {
  return (
    <BackofficeAuthProvider>
      <Routes>
        <Route path="login" element={<BackofficeLoginPage />} />
        <Route path="backoffice" element={<ProtectedBackofficeRoute><BackofficeLayout /></ProtectedBackofficeRoute>}>
          <Route index element={<Navigate to="pending-registrations" replace />} />
          <Route path="pending-registrations" element={<PendingProfessionalsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="login" replace />} />
      </Routes>
    </BackofficeAuthProvider>
  );
}
