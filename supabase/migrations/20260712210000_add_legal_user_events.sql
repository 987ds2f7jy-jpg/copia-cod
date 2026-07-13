begin;

create table if not exists public.legal_user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete restrict,
  document_key text not null,
  document_version text not null,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  source text not null default 'account',
  locale text not null default 'pt-BR',
  created_at timestamptz not null default now(),
  constraint legal_user_events_document_key_check
    check (document_key in ('terms_of_use', 'privacy_notice', 'telemedicine_consent', 'transcription_consent')),
  constraint legal_user_events_event_type_check
    check (event_type in ('accepted', 'acknowledged', 'revoked')),
  constraint legal_user_events_document_version_check
    check (char_length(document_version) between 1 and 32),
  constraint legal_user_events_source_check
    check (source in ('signup_patient', 'signup_professional', 'account')),
  constraint legal_user_events_locale_check
    check (char_length(locale) between 2 and 16),
  constraint legal_user_events_unique_event
    unique (user_id, document_key, document_version, event_type)
);

create index if not exists idx_legal_user_events_user_occurred_at
  on public.legal_user_events (user_id, occurred_at desc);

create index if not exists idx_legal_user_events_document_version
  on public.legal_user_events (document_key, document_version, occurred_at desc);

alter table public.legal_user_events enable row level security;
alter table public.legal_user_events force row level security;

revoke all on table public.legal_user_events from public, anon, authenticated;
grant select, insert on table public.legal_user_events to service_role;

comment on table public.legal_user_events is
  'Append-only server-side record of versioned legal acceptance and acknowledgement events.';

commit;
