CREATE TABLE IF NOT EXISTS public.zoom_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_hash TEXT NOT NULL,
  provider_event_id TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL,
  event_ts TIMESTAMPTZ,
  session_name TEXT NOT NULL DEFAULT '',
  session_key TEXT NOT NULL DEFAULT '',
  zoom_session_id TEXT NOT NULL DEFAULT '',
  zoom_user_id TEXT NOT NULL DEFAULT '',
  zoom_user_key TEXT NOT NULL DEFAULT '',
  zoom_user_name TEXT NOT NULL DEFAULT '',
  zoom_leave_reason TEXT NOT NULL DEFAULT '',
  consulta_id UUID REFERENCES public.consultas(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processing_error TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_zoom_webhook_events_event_hash_unique
  ON public.zoom_webhook_events (event_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_zoom_webhook_events_provider_event_unique
  ON public.zoom_webhook_events (provider_event_id)
  WHERE provider_event_id <> '';

CREATE INDEX IF NOT EXISTS idx_zoom_webhook_events_event_type
  ON public.zoom_webhook_events (event_type);

CREATE INDEX IF NOT EXISTS idx_zoom_webhook_events_session_name
  ON public.zoom_webhook_events (session_name)
  WHERE session_name <> '';

CREATE INDEX IF NOT EXISTS idx_zoom_webhook_events_session_key
  ON public.zoom_webhook_events (session_key)
  WHERE session_key <> '';

CREATE INDEX IF NOT EXISTS idx_zoom_webhook_events_consulta_id
  ON public.zoom_webhook_events (consulta_id)
  WHERE consulta_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_zoom_webhook_events_received_at
  ON public.zoom_webhook_events (received_at DESC);

ALTER TABLE public.zoom_webhook_events ENABLE ROW LEVEL SECURITY;
