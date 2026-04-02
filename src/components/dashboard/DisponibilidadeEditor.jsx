import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { ALL_TIME_SLOTS, WEEKDAY_LABELS } from '@/lib/scheduling';

// weekdays: 0=Dom, 1=Seg, ..., 6=Sáb
const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export default function DisponibilidadeEditor({ professional }) {
  const queryClient = useQueryClient();

  // Carregar slots existentes
  const { data: existingSlots = [], isLoading } = useQuery({
    queryKey: ['avail-slots', professional?.id],
    queryFn: () => base44.entities.AvailabilitySlot.filter({ professional_id: professional.id }),
    enabled: !!professional?.id,
  });

  // Estado local: Set de "weekday|time_slot"
  const [selected, setSelected] = useState(new Set());
  const [activeDay, setActiveDay] = useState(1); // Seg por padrão

  useEffect(() => {
    if (existingSlots.length > 0) {
      const s = new Set(existingSlots.map(slot => `${slot.weekday}|${slot.time_slot}`));
      setSelected(s);
    }
  }, [existingSlots]);

  const toggle = (weekday, time) => {
    const key = `${weekday}|${time}`;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isSelected = (weekday, time) => selected.has(`${weekday}|${time}`);

  const slotsForDay = (weekday) => ALL_TIME_SLOTS.filter(t => selected.has(`${weekday}|${t}`));

  const saveMutation = useMutation({
    mutationFn: async () => {
      // 1. Deletar todos os slots atuais
      for (const slot of existingSlots) {
        await base44.entities.AvailabilitySlot.delete(slot.id);
      }

      // 2. Criar os novos slots selecionados
      const toCreate = [];
      selected.forEach(key => {
        const [weekday, time_slot] = key.split('|');
        toCreate.push({ professional_id: professional.id, weekday: Number(weekday), time_slot });
      });

      if (toCreate.length > 0) {
        await base44.entities.AvailabilitySlot.bulkCreate(toCreate);
      }
    },
    onSuccess: () => {
      toast.success('Disponibilidade salva!');
      queryClient.invalidateQueries({ queryKey: ['avail-slots', professional?.id] });
    },
    onError: (err) => toast.error(err?.message || 'Erro ao salvar disponibilidade'),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-600" />
          Disponibilidade por Dia
        </CardTitle>
        <p className="text-xs text-gray-400">
          Selecione os dias e horários que você atende. Cada dia pode ter horários diferentes.
          Slots de 20 minutos · 08:00–17:40
        </p>
      </CardHeader>
      <CardContent>
        {/* Day tabs */}
        <div className="flex gap-1.5 flex-wrap mb-4">
          {ALL_WEEKDAYS.map(wd => {
            const count = slotsForDay(wd).length;
            return (
              <button
                key={wd}
                onClick={() => setActiveDay(wd)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  activeDay === wd
                    ? 'bg-emerald-600 text-white'
                    : count > 0
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {WEEKDAY_LABELS[wd]}
                {count > 0 && (
                  <span className={`text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold ${
                    activeDay === wd ? 'bg-white/20 text-white' : 'bg-emerald-500 text-white'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Time slots for active day */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-5">
          {ALL_TIME_SLOTS.map(time => (
            <button
              key={time}
              onClick={() => toggle(activeDay, time)}
              className={`py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                isSelected(activeDay, time)
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {time}
            </button>
          ))}
        </div>

        {/* Summary */}
        <div className="mb-4 p-3 bg-gray-50 rounded-xl">
          <p className="text-xs text-gray-500 font-medium mb-2">Resumo da semana:</p>
          <div className="space-y-1">
            {ALL_WEEKDAYS.map(wd => {
              const slots = slotsForDay(wd);
              if (slots.length === 0) return null;
              return (
                <div key={wd} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 w-8 shrink-0">{WEEKDAY_LABELS[wd]}:</span>
                  <span className="text-gray-700">{slots.join(', ')}</span>
                </div>
              );
            })}
            {selected.size === 0 && (
              <p className="text-xs text-gray-400">Nenhum horário selecionado.</p>
            )}
          </div>
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Disponibilidade
        </Button>
      </CardContent>
    </Card>
  );
}