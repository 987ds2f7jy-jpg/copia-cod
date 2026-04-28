import React from 'react';
import { CheckCircle, Clock, Zap } from 'lucide-react';

const DAYS_MAP = {
  'seg': 'Seg', 'ter': 'Ter', 'qua': 'Qua', 'qui': 'Qui', 'sex': 'Sex', 'sab': 'Sáb', 'dom': 'Dom',
  'segunda': 'Seg', 'terca': 'Ter', 'quarta': 'Qua', 'quinta': 'Qui', 'sexta': 'Sex', 'sabado': 'Sáb', 'domingo': 'Dom',
};
const ALL_DAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
const LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export default function ProfileAvailability({ professional }) {
  const availDays = (professional.available_days || []).map(d => d.toLowerCase());

  function isDayAvailable(dayKey) {
    return availDays.some(d => d.startsWith(dayKey.slice(0, 3)) || d === DAYS_MAP[dayKey]?.toLowerCase());
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-500" />
          Disponibilidade
        </h2>
        {professional.is_on_duty && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full dark:bg-emerald-950/40 dark:text-emerald-300">
            <Zap className="w-3 h-3" />
            Plantão ativo
          </span>
        )}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1.5 mb-5">
        {ALL_DAYS.map((day, i) => {
          const available = isDayAvailable(day);
          return (
            <div key={day} className={`rounded-xl py-2.5 text-center transition-colors ${available ? 'bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/60' : 'bg-muted/50 border border-border'}`}>
              <p className={`text-xs font-semibold ${available ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}`}>{LABELS[i]}</p>
              {available && <CheckCircle className="w-3 h-3 text-emerald-500 mx-auto mt-1" />}
            </div>
          );
        })}
      </div>

      {/* Hours */}
      {professional.available_hours?.length > 0 && (
        <div>
          <p className="text-sm text-muted-foreground mb-2">Horários disponíveis</p>
          <div className="flex flex-wrap gap-2">
            {professional.available_hours.map(hour => (
              <span key={hour} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm rounded-lg font-medium border border-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-900/60">
                {hour}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
