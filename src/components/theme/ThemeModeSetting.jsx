import React, { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

const themeOptions = [
  {
    value: 'light',
    label: 'Claro',
    description: 'Interface clara',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Escuro',
    description: 'Interface escura',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'Sistema',
    description: 'Usar dispositivo',
    icon: Monitor,
  },
];

export default function ThemeModeSetting() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = mounted ? theme || 'system' : 'system';

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">Aparência</h3>
        <p className="text-sm text-muted-foreground">
          Escolha como o Rápido Doutor deve aparecer neste dispositivo.
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {themeOptions.map((option) => {
          const Icon = option.icon;
          const isActive = currentTheme === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                isActive
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
              aria-pressed={isActive}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  isActive
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="block text-xs opacity-80">{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      {mounted && currentTheme === 'system' ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Atualmente seguindo o sistema: {resolvedTheme === 'dark' ? 'escuro' : 'claro'}.
        </p>
      ) : null}
    </div>
  );
}
