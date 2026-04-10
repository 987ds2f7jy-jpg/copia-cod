import React, { useState, useMemo } from 'react';
import { entities } from '@/client-api/readModels';
import { useQuery } from '@tanstack/react-query';
import { Clock, ChevronLeft, ChevronRight, CalendarDays, Zap } from 'lucide-react';
import { WEEKDAY_LABELS } from '@/lib/scheduling';

// Maps JS getDay() (0=Sun) to our weekday numbers (0=Dom, 1=Seg...)
// Both are 0=Sunday so they match directly

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstWeekday(year, month) {
  // 0=Sun ... 6=Sat, but we display Mon first
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // convert to Mon-based: Mon=0, ..., Sun=6
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const DAY_HEADERS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

// Map Mon-based index (0=Mon) to JS weekday number we use in AvailabilitySlot (0=Dom,1=Seg,...,6=Sáb)
const MON_BASED_TO_SLOT_WEEKDAY = [1, 2, 3, 4, 5, 6, 0]; // Mon->1, Tue->2, ..., Sun->0

export default function ProfileCalendar({ professional }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);

  const { data: slots = [] } = useQuery({
    queryKey: ['avail-slots-public', professional?.id],
    queryFn: () => entities.AvailabilitySlot.filter({ professional_id: professional.id }),
    enabled: !!professional?.id,
    staleTime: 120_000,
  });

  // Build a map: weekday -> sorted time slots
  const slotsByWeekday = useMemo(() => {
    const map = {};
    for (const s of slots) {
      if (!map[s.weekday]) map[s.weekday] = [];
      map[s.weekday].push(s.time_slot);
    }
    // Sort each
    for (const wd of Object.keys(map)) {
      map[wd].sort();
    }
    return map;
  }, [slots]);

  // Determine which weekdays have slots
  const activeWeekdays = new Set(Object.keys(slotsByWeekday).map(Number));

  const daysInMonth = getDaysInMonth(year, month);
  const firstWeekday = getFirstWeekday(year, month); // 0=Mon offset

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  // Build calendar grid
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const isPast = (d) => new Date(year, month, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const getDayWeekday = (d) => {
    const jsDay = new Date(year, month, d).getDay(); // 0=Sun
    return jsDay; // matches our slot weekday (0=Dom)
  };

  const isDayAvailable = (d) => {
    if (isPast(d)) return false;
    const wd = getDayWeekday(d);
    return activeWeekdays.has(wd);
  };

  const selectedSlots = selectedDay !== null
    ? (slotsByWeekday[getDayWeekday(selectedDay)] || [])
    : [];

  const hasSlots = slots.length > 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-indigo-500" />
          Disponibilidade
        </h2>
        {professional?.is_on_duty && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <Zap className="w-3 h-3" />
            Plantão ativo
          </span>
        )}
      </div>

      {!hasSlots ? (
        <p className="text-sm text-gray-400 text-center py-6">Nenhum horário configurado ainda.</p>
      ) : (
        <>
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-sm font-semibold text-gray-800">
              {MONTH_NAMES[month]} {year}
            </span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_HEADERS.map(h => (
              <div key={h} className="text-center text-xs font-medium text-gray-400 py-1">{h}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1 mb-5">
            {cells.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} />;
              const available = isDayAvailable(day);
              const selected = selectedDay === day;
              const past = isPast(day);
              return (
                <button
                  key={day}
                  disabled={!available}
                  onClick={() => setSelectedDay(selected ? null : day)}
                  className={`
                    aspect-square rounded-xl text-sm font-medium transition-all flex flex-col items-center justify-center
                    ${selected ? 'bg-emerald-600 text-white shadow-sm' : ''}
                    ${available && !selected ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200' : ''}
                    ${past ? 'text-gray-300 cursor-default' : ''}
                    ${!available && !past ? 'text-gray-300 cursor-default' : ''}
                    ${isToday(day) && !selected ? 'ring-2 ring-emerald-400 ring-offset-1' : ''}
                  `}
                >
                  {day}
                  {available && !selected && (
                    <span className="w-1 h-1 bg-emerald-500 rounded-full mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected day time slots */}
          {selectedDay !== null && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                Horários disponíveis — {selectedDay}/{month + 1}/{year}
              </p>
              {selectedSlots.length === 0 ? (
                <p className="text-sm text-gray-400">Sem horários nesse dia.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedSlots.map(time => (
                    <span
                      key={time}
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm rounded-lg font-medium border border-indigo-100"
                    >
                      {time}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200 inline-block" /> Disponível</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-600 inline-block" /> Selecionado</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded ring-2 ring-emerald-400 inline-block" /> Hoje</span>
          </div>
        </>
      )}
    </div>
  );
}
