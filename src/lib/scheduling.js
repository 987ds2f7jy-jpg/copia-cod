/**
 * scheduling.js — Regras centralizadas de agendamento
 */

export const VALID_MINUTES = [0, 20, 40];

export function generateTimeSlots() {
  const slots = [];
  for (let h = 8; h < 18; h++) {
    for (const m of VALID_MINUTES) {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      slots.push(`${hh}:${mm}`);
    }
  }
  return slots;
}

export const ALL_TIME_SLOTS = generateTimeSlots();

export function validateSchedulingWindow(datetime) {
  const now = new Date();
  const dt = new Date(datetime);
  const minDate = new Date(now.getTime() + 36 * 60 * 60 * 1000);
  const maxDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  if (dt < minDate) return { valid: false, reason: 'Agendamento deve ser com no mínimo 36 horas de antecedência.' };
  if (dt > maxDate) return { valid: false, reason: 'Agendamento deve ser com no máximo 14 dias à frente.' };
  const hours = dt.getHours();
  const minutes = dt.getMinutes();
  if (hours < 8 || hours >= 18) return { valid: false, reason: 'Horário deve estar entre 08:00 e 17:40.' };
  if (!VALID_MINUTES.includes(minutes)) return { valid: false, reason: 'Minutos devem ser 00, 20 ou 40.' };
  return { valid: true, reason: null };
}

export function validateSchedulingWindowByType(datetime, tipo) {
  const TIPOS_SEM_36H = ['prioritario', 'plantao', 'priority', 'instant', 'IMEDIATO'];
  if (TIPOS_SEM_36H.includes(tipo)) {
    const now = new Date();
    const dt = new Date(datetime);
    if (dt < new Date(now.getTime() - 2 * 60 * 60 * 1000)) return { valid: false, reason: 'Horário já passou.' };
    return { valid: true, reason: null };
  }
  return validateSchedulingWindow(datetime);
}

export function isWeekday(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

export function getWeekdayFromDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function buildDatetime(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00`;
}

export function computeAvailableSlots(availabilitySlots, bookedDatetimes, dateStr) {
  const weekday = getWeekdayFromDateStr(dateStr);
  const configured = availabilitySlots
    .filter(s => s.weekday === weekday)
    .map(s => s.time_slot);
  if (configured.length === 0) return [];
  const bookedTimes = new Set(
    bookedDatetimes
      .filter(dt => dt.startsWith(dateStr))
      .map(dt => dt.substring(11, 16))
  );
  return configured.filter(slot => !bookedTimes.has(slot));
}

export const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAY_LABELS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
