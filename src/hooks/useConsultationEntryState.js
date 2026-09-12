import { useEffect, useState } from 'react';

const COUNTDOWN_WINDOW_MS = 5 * 60 * 1000;
const ONGOING_STATUSES = new Set(['em_atendimento', 'in_progress']);

function normalized(value) {
  return String(value ?? '').trim();
}

function parseAbsoluteTimestamp(value) {
  const raw = normalized(value);
  if (!/(?:z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
    return null;
  }
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getConsultationEntryState(activeConsultation, now = Date.now()) {
  const consultation = activeConsultation?.consultation;
  const eligibility = activeConsultation?.entryEligibility;
  const status = normalized(consultation?.status);
  const consultationType = normalized(consultation?.consultationType);

  if (!activeConsultation?.hasActiveConsultation || !consultation?.id) {
    return { kind: 'hidden' };
  }

  if (ONGOING_STATUSES.has(status)) {
    return { kind: 'resume' };
  }

  // Plantão is an immediate-care flow. It deliberately has no scheduled-entry window.
  if (consultationType === 'plantao' && status === 'aguardando') {
    return { kind: 'resume' };
  }

  if (status !== 'aguardando') {
    return { kind: 'hidden' };
  }

  if (eligibility?.effectivelyExpired || eligibility?.state === 'deadline_elapsed') {
    return { kind: 'hidden' };
  }

  // Server supplies absolute ISO timestamps after interpreting legacy local
  // scheduling values. The browser only presents that result; it never decides
  // the authoritative deadline.
  const scheduledAt = parseAbsoluteTimestamp(eligibility?.scheduledAt);
  if (scheduledAt == null) {
    return { kind: 'hidden' };
  }

  const remainingMs = scheduledAt - now;
  if (remainingMs > COUNTDOWN_WINDOW_MS) {
    return {
      kind: 'hidden',
      nextRefreshAt: scheduledAt - COUNTDOWN_WINDOW_MS,
    };
  }

  if (remainingMs > 0) {
    return {
      kind: 'countdown',
      remainingMs,
      nextRefreshAt: now + 1000,
    };
  }

  const deadlineAt = parseAbsoluteTimestamp(eligibility?.deadlineAt);
  if (deadlineAt != null && now > deadlineAt) {
    return { kind: 'hidden' };
  }

  return { kind: 'ready' };
}

export function formatConsultationCountdown(remainingMs) {
  const totalSeconds = Math.max(0, Math.ceil(Number(remainingMs || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function useConsultationEntryState(activeConsultation) {
  const [now, setNow] = useState(() => Date.now());
  const state = getConsultationEntryState(activeConsultation, now);

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const nextRefreshAt = state.nextRefreshAt;
    const delay = Number.isFinite(nextRefreshAt)
      ? Math.max(0, nextRefreshAt - Date.now())
      : null;
    const intervalId = state.kind === 'countdown'
      ? window.setInterval(refresh, 1000)
      : null;
    // Recheck long future appointments periodically; browsers clamp very large timeouts.
    const timerId = intervalId == null && delay != null
      ? window.setTimeout(refresh, Math.min(delay, 60 * 60 * 1000))
      : null;

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      if (timerId != null) {
        window.clearTimeout(timerId);
      }
      if (intervalId != null) {
        window.clearInterval(intervalId);
      }
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [state.kind, state.nextRefreshAt]);

  return state;
}
