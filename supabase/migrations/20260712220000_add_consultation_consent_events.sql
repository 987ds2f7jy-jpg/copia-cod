begin;

create table if not exists public.consultation_consent_events (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references public.consultas(id) on delete restrict,
  patient_user_id uuid not null references public.app_users(id) on delete restrict,
  consent_key text not null,
  document_version text not null,
  decision text not null,
  occurred_at timestamptz not null default now(),
  source text not null default 'teleconsulta_entry',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint consultation_consent_events_key_check check (
    consent_key in (
      'telemedicine_consent',
      'consultation_transcription_consent',
      'ai_assistance_notice'
    )
  ),
  constraint consultation_consent_events_decision_check check (
    (consent_key = 'telemedicine_consent' and decision = 'granted')
    or (consent_key = 'consultation_transcription_consent' and decision in ('granted', 'declined', 'revoked'))
    or (consent_key = 'ai_assistance_notice' and decision = 'acknowledged')
  ),
  constraint consultation_consent_events_version_check
    check (char_length(document_version) between 1 and 32),
  constraint consultation_consent_events_source_check
    check (source in ('teleconsulta_entry', 'teleconsulta_session')),
  constraint consultation_consent_events_idempotency_check
    check (char_length(idempotency_key) between 8 and 120),
  constraint consultation_consent_events_idempotency_unique
    unique (consulta_id, patient_user_id, idempotency_key)
);

create index if not exists idx_consultation_consent_events_latest
  on public.consultation_consent_events (
    consulta_id,
    patient_user_id,
    consent_key,
    occurred_at desc,
    created_at desc
  );

alter table public.consultation_consent_events enable row level security;
alter table public.consultation_consent_events force row level security;
revoke all on table public.consultation_consent_events from public, anon, authenticated;
grant select, insert on table public.consultation_consent_events to service_role;

create or replace function public.prevent_consultation_consent_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'consultation consent events are immutable' using errcode = '55000';
end;
$$;

revoke all on function public.prevent_consultation_consent_event_mutation()
  from public, anon, authenticated;

drop trigger if exists prevent_consultation_consent_event_mutation
  on public.consultation_consent_events;
create trigger prevent_consultation_consent_event_mutation
  before update or delete on public.consultation_consent_events
  for each row execute function public.prevent_consultation_consent_event_mutation();

create or replace function public.sanitize_system_audit_metadata(p_metadata jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'provider', p_metadata -> 'provider',
    'retry_count', p_metadata -> 'retry_count',
    'previous_status', p_metadata -> 'previous_status',
    'next_status', p_metadata -> 'next_status',
    'issue_type', p_metadata -> 'issue_type',
    'reason_code', p_metadata -> 'reason_code',
    'external_status', p_metadata -> 'external_status',
    'payment_charge_id', p_metadata -> 'payment_charge_id',
    'plan_credit_usage_id', p_metadata -> 'plan_credit_usage_id',
    'owner_type', p_metadata -> 'owner_type',
    'consent_key', p_metadata -> 'consent_key',
    'decision', p_metadata -> 'decision',
    'document_version', p_metadata -> 'document_version'
  ));
$$;

revoke all on function public.sanitize_system_audit_metadata(jsonb)
  from public, anon, authenticated;
grant execute on function public.sanitize_system_audit_metadata(jsonb) to service_role;

comment on table public.consultation_consent_events is
  'Immutable, consultation-scoped patient decisions for telemedicine, transcription and AI assistance notices.';

commit;
