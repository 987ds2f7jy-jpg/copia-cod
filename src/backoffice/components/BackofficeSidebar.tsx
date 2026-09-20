import { BarChart3, ClipboardList, Settings2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const items = [
  { to: '/admin/backoffice/pending-registrations', label: 'Cadastros pendentes', icon: ClipboardList },
  { to: '/admin/backoffice/analytics', label: 'Análise de dados', icon: BarChart3 },
  { to: '/admin/backoffice/services', label: 'Serviços', icon: Settings2 },
];

export function BackofficeSidebar() {
  return (
    <aside className="w-full border-b bg-card md:min-h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rápido Doutor</p>
        <h1 className="mt-1 text-xl font-bold text-foreground">Backoffice</h1>
      </div>
      <nav className="flex gap-2 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `flex shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
