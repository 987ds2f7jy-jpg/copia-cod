begin;

alter table public.app_users
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivation_reason_code text;

create table if not exists public.privacy_rights_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references public.app_users(id) on delete restrict,
  request_type text not null,
  status text not null default 'submitted',
  description text not null default '',
  request_fingerprint text not null,
  idempotency_key text not null,
  assigned_admin_user_id uuid references public.app_users(id) on delete set null,
  decision_code text,
  decision_note text,
  public_response text,
  review_version integer not null default 0,
  export_storage_path text,
  export_expires_at timestamptz,
  submitted_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint privacy_rights_requests_type_check check (
    request_type in (
      'access',
      'export',
      'correction',
      'account_deactivation',
      'deletion_or_anonymization',
      'consent_information'
    )
  ),
  constraint privacy_rights_requests_status_check check (
    status in (
      'submitted',
      'in_review',
      'awaiting_user',
      'approved',
      'partially_approved',
      'rejected',
      'completed',
      'canceled'
    )
  ),
  constraint privacy_rights_requests_description_check
    check (char_length(description) <= 2000),
  constraint privacy_rights_requests_fingerprint_check
    check (char_length(request_fingerprint) = 64),
  constraint privacy_rights_requests_idempotency_check
    check (char_length(idempotency_key) between 8 and 120),
  constraint privacy_rights_requests_decision_note_check
    check (decision_note is null or char_length(decision_note) <= 2000),
  constraint privacy_rights_requests_public_response_check
    check (public_response is null or char_length(public_response) <= 1000),
  constraint privacy_rights_requests_review_version_check
    check (review_version >= 0),
  constraint privacy_rights_requests_idempotency_unique
    unique (requester_user_id, idempotency_key)
);

create unique index if not exists idx_privacy_rights_requests_open_fingerprint
  on public.privacy_rights_requests (requester_user_id, request_type, request_fingerprint)
  where status in ('submitted', 'in_review', 'awaiting_user', 'approved', 'partially_approved');

create index if not exists idx_privacy_rights_requests_requester
  on public.privacy_rights_requests (requester_user_id, submitted_at desc);

create index if not exists idx_privacy_rights_requests_status_type
  on public.privacy_rights_requests (status, request_type, submitted_at asc);

create index if not exists idx_privacy_rights_requests_assignee
  on public.privacy_rights_requests (assigned_admin_user_id, updated_at desc)
  where assigned_admin_user_id is not null;

alter table public.privacy_rights_requests enable row level security;
alter table public.privacy_rights_requests force row level security;
revoke all on table public.privacy_rights_requests from public, anon, authenticated;
grant select, insert, update on table public.privacy_rights_requests to service_role;

drop trigger if exists update_privacy_rights_requests_updated_at
  on public.privacy_rights_requests;
create trigger update_privacy_rights_requests_updated_at
  before update on public.privacy_rights_requests
  for each row execute function public.update_updated_at_column();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'privacy-exports',
  'privacy-exports',
  false,
  5242880,
  array['application/json']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

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
    'document_version', p_metadata -> 'document_version',
    'request_type', p_metadata -> 'request_type',
    'request_status', p_metadata -> 'request_status',
    'decision_code', p_metadata -> 'decision_code',
    'export_format', p_metadata -> 'export_format'
  ));
$$;

revoke all on function public.sanitize_system_audit_metadata(jsonb)
  from public, anon, authenticated;
grant execute on function public.sanitize_system_audit_metadata(jsonb) to service_role;

comment on table public.privacy_rights_requests is
  'Restricted workflow for data-subject requests. It stores no clinical content and performs no automatic deletion.';
comment on column public.privacy_rights_requests.decision_note is
  'Internal administrative note. Never returned by the self-service API.';
comment on column public.privacy_rights_requests.export_storage_path is
  'Internal path in the private privacy-exports bucket. Never returned directly to clients.';

commit;
