import { LogOut } from 'lucide-react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useBackofficeAuth } from '../hooks/useBackofficeAuth';
import { BackofficeSidebar } from './BackofficeSidebar';

export function BackofficeLayout() {
  const { admin, logout } = useBackofficeAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-muted/30 md:flex">
      <BackofficeSidebar />
      <div className="min-w-0 flex-1">
        <header className="flex min-h-16 items-center justify-between gap-4 border-b bg-background px-5 py-3 md:px-8">
          <div>
            <p className="text-sm font-medium text-foreground">Área administrativa</p>
            <p className="text-xs text-muted-foreground">{admin?.email}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </header>
        <main className="mx-auto w-full max-w-7xl p-5 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
